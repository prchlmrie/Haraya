import { randomInt } from 'node:crypto';
import { transaction } from './db.js';
import { isValidDate, today } from './dates.js';
import { AppError, validateGuest } from './validation.js';
import { VENUES, venueByCode } from './venues.js';

export const EVENT_CATEGORIES = ['Workshop', 'Performance', 'Music', 'Film', 'Wedding', 'Birthday', 'Corporate', 'Gala', 'Banquet', 'Festive', 'Other'];
export const EVENT_STATUSES = ['Pending', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled'];
export const REGISTRATION_MODES = ['open', 'invite', 'none'];
export const POSTER_THEMES = ['cake', 'jazz', 'theater', 'film', 'wedding', 'gala', 'corporate', 'music', 'festive', 'birthday'];
const BLOCKING = ['Pending', 'Scheduled', 'Ongoing'];
const MAX_TICKETS = 6;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const code = (prefix, n) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return prefix + Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join('');
};
const peso = (n) => `PHP ${Number(n).toLocaleString('en-US')}`;

function systemNow() {
  const d = new Date();
  return { date: today(), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
}

/** Upcoming / Ongoing / Completed for scheduled events, based on the clock. */
export function phaseOf(event, now) {
  if (event.status !== 'Scheduled') return event.status;
  if (event.date > now.date || (event.date === now.date && event.startTime > now.time)) return 'Upcoming';
  if (event.date === now.date && event.endTime > now.time) return 'Ongoing';
  return 'Completed';
}

export function createEventService(db, { now = systemNow } = {}) {
  const stmt = {
    byId: db.prepare('SELECT * FROM events WHERE id = ?'),
    codeExists: db.prepare('SELECT 1 FROM events WHERE code = ?'),
    refExists: db.prepare('SELECT 1 FROM event_registrations WHERE reference = ?'),
    conflicts: db.prepare(`
      SELECT * FROM events
      WHERE venue = ? AND date = ? AND id <> ?
        AND status IN (${BLOCKING.map((s) => `'${s}'`).join(', ')})
        AND start_time < ? AND ? < end_time
      ORDER BY start_time
    `),
    registered: db.prepare("SELECT COALESCE(SUM(tickets), 0) AS n FROM event_registrations WHERE event_id = ? AND status = 'Registered'"),
    registrations: db.prepare('SELECT * FROM event_registrations WHERE event_id = ? ORDER BY created_at, id'),
    regByRef: db.prepare('SELECT * FROM event_registrations WHERE reference = ?'),
    regById: db.prepare('SELECT * FROM event_registrations WHERE id = ?'),
    duplicateReg: db.prepare("SELECT 1 FROM event_registrations WHERE event_id = ? AND email = ? AND status = 'Registered'"),
    insertEvent: db.prepare(`
      INSERT INTO events (code, title, category, description, includes, venue, setup, date, start_time, end_time,
        capacity, price, price_note, registration, status, visibility, organizer, contact_email, contact_phone, poster, sample_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateEvent: db.prepare(`
      UPDATE events SET title = ?, category = ?, description = ?, includes = ?, venue = ?, setup = ?, date = ?,
        start_time = ?, end_time = ?, capacity = ?, price = ?, price_note = ?, registration = ?, visibility = ?,
        organizer = ?, contact_email = ?, contact_phone = ?, poster = ?, sample_note = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `),
    setStatus: db.prepare("UPDATE events SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"),
    insertReg: db.prepare(`
      INSERT INTO event_registrations (reference, event_id, first_name, last_name, email, phone, tickets, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    cancelReg: db.prepare("UPDATE event_registrations SET status = 'Cancelled', cancelled_at = datetime('now', 'localtime') WHERE id = ?"),
    notify: db.prepare('INSERT INTO notifications (reservation_id, reference, recipient, type, subject, message) VALUES (NULL, ?, ?, ?, ?, ?)'),
  };

  function toEvent(row, { withPrivate = true } = {}) {
    if (!row) return null;
    const venue = venueByCode(row.venue);
    const registered = stmt.registered.get(row.id).n;
    const event = {
      id: row.id,
      code: row.code,
      title: row.title,
      category: row.category,
      description: row.description,
      includes: row.includes ? row.includes.split('\n').filter(Boolean) : [],
      venue: row.venue,
      venueName: venue?.name ?? row.venue,
      venueFloor: venue?.floor ?? '',
      setup: row.setup,
      setupLabel: venue?.setups.find((s) => s.id === row.setup)?.label ?? '',
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      capacity: row.capacity,
      registered,
      remaining: Math.max(0, row.capacity - registered),
      price: row.price,
      priceNote: row.price_note,
      registration: row.registration,
      status: row.status,
      visibility: row.visibility,
      poster: row.poster,
      sampleNote: row.sample_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    event.phase = phaseOf(event, now());
    event.canRegister = event.registration === 'open' && event.phase === 'Upcoming' && event.remaining > 0;
    if (withPrivate) Object.assign(event, { organizer: row.organizer, contactEmail: row.contact_email, contactPhone: row.contact_phone });
    return event;
  }

  function getRow(id) {
    const row = stmt.byId.get(Number(id));
    if (!row) throw new AppError('Event not found.', 404);
    return row;
  }

  // ---------- validation ----------

  function validateEvent(input, { current = null, allowPast = false } = {}) {
    const e = {
      title: clean(input.title),
      category: clean(input.category) || 'Other',
      description: clean(input.description),
      includes: (Array.isArray(input.includes) ? input.includes : String(input.includes ?? '').split('\n')).map(clean).filter(Boolean).join('\n'),
      venue: clean(input.venue).toUpperCase(),
      setup: clean(input.setup),
      date: clean(input.date),
      startTime: clean(input.startTime),
      endTime: clean(input.endTime),
      capacity: Number(input.capacity),
      price: input.price === '' || input.price == null ? 0 : Number(input.price),
      priceNote: clean(input.priceNote),
      registration: clean(input.registration) || 'open',
      visibility: clean(input.visibility) || 'public',
      organizer: clean(input.organizer),
      contactEmail: clean(input.contactEmail).toLowerCase(),
      contactPhone: clean(input.contactPhone),
      poster: clean(input.poster) || 'gala',
      sampleNote: clean(input.sampleNote),
    };
    const errors = {};
    const venue = venueByCode(e.venue);
    if (!e.title) errors.title = 'Event title is required.';
    else if (e.title.length > 120) errors.title = 'Title is too long (120 characters max).';
    if (!EVENT_CATEGORIES.includes(e.category)) errors.category = 'Select a valid category.';
    if (e.description.length > 4000) errors.description = 'Description is too long.';
    if (!venue) errors.venue = 'Select a venue.';
    if (venue && venue.setups.length && !venue.setups.some((s) => s.id === e.setup)) errors.setup = 'Select a room setup for this venue.';
    if (venue && !venue.setups.length) e.setup = '';
    if (!isValidDate(e.date)) errors.date = 'Enter a valid date.';
    else if (!allowPast && e.date < now().date && e.date !== current?.date) errors.date = 'Event date cannot be in the past.';
    if (!TIME.test(e.startTime)) errors.startTime = 'Enter a start time (HH:MM).';
    if (!TIME.test(e.endTime)) errors.endTime = 'Enter an end time (HH:MM).';
    else if (!errors.startTime && e.endTime <= e.startTime) errors.endTime = 'End time must be after the start time (events end on the same day).';
    const maxCap = venue ? (venue.setups.find((s) => s.id === e.setup)?.capacity ?? venue.capacity) : Infinity;
    if (!Number.isInteger(e.capacity) || e.capacity < 1) errors.capacity = 'Capacity must be a whole number of at least 1.';
    else if (e.capacity > maxCap) errors.capacity = `${venue.name}${e.setup ? ` (${venue.setups.find((s) => s.id === e.setup).label})` : ''} holds at most ${maxCap} people.`;
    else if (current && e.capacity < stmt.registered.get(current.id).n) errors.capacity = `Capacity cannot be below the ${stmt.registered.get(current.id).n} places already registered.`;
    if (!Number.isFinite(e.price) || e.price < 0 || !Number.isInteger(e.price)) errors.price = 'Price must be zero or a whole peso amount.';
    if (!REGISTRATION_MODES.includes(e.registration)) errors.registration = 'Select a registration option.';
    if (!['public', 'private'].includes(e.visibility)) errors.visibility = 'Select public or private.';
    if (!POSTER_THEMES.includes(e.poster)) e.poster = 'gala';
    if (e.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.contactEmail)) errors.contactEmail = 'Enter a valid email address.';
    if (Object.keys(errors).length) throw new AppError('Please correct the highlighted event details.', 400, errors);
    return e;
  }

  function findConflicts({ venue, date, startTime, endTime, excludeId = 0 }) {
    if (!venueByCode(venue) || !isValidDate(date) || !TIME.test(startTime ?? '') || !TIME.test(endTime ?? '') || endTime <= startTime) return [];
    return stmt.conflicts.all(venue, date, Number(excludeId) || 0, endTime, startTime).map((r) => toEvent(r));
  }

  function assertNoConflict(e, excludeId = 0, { masked = false } = {}) {
    const clash = findConflicts({ ...e, excludeId });
    if (clash.length) {
      const c = clash[0];
      const what = masked ? 'another booking' : `"${c.title}" (${c.code})`;
      throw new AppError(
        `${venueByCode(e.venue).name} is already booked from ${c.startTime} to ${c.endTime} on ${c.date} for ${what}. Choose another time or venue.`,
        409,
        { startTime: 'Overlaps another event in this venue.', endTime: 'Overlaps another event in this venue.' },
      );
    }
  }

  function newCode(prefix, n, exists) {
    let c;
    do c = code(prefix, n); while (exists.get(c));
    return c;
  }

  function notify(reference, recipient, type, subject, message) {
    if (recipient) stmt.notify.run(reference, recipient, type, subject, message);
  }

  // ---------- events ----------

  function createEvent(input, { status = 'Scheduled', allowPast = false, maskConflicts = false } = {}) {
    return transaction(db, () => {
      const e = validateEvent(input, { allowPast });
      assertNoConflict(e, 0, { masked: maskConflicts });
      const c = newCode('EVT-', 5, stmt.codeExists);
      const { lastInsertRowid } = stmt.insertEvent.run(c, e.title, e.category, e.description, e.includes, e.venue, e.setup, e.date,
        e.startTime, e.endTime, e.capacity, e.price, e.priceNote, e.registration, status, e.visibility, e.organizer,
        e.contactEmail, e.contactPhone, e.poster, e.sampleNote);
      return toEvent(stmt.byId.get(lastInsertRowid));
    });
  }

  function updateEvent(id, input) {
    return transaction(db, () => {
      const row = getRow(id);
      if (row.status === 'Cancelled' || row.status === 'Completed') throw new AppError(`A ${row.status.toLowerCase()} event cannot be edited.`, 409);
      const e = validateEvent(input, { current: { id: row.id, date: row.date } });
      assertNoConflict(e, row.id);
      stmt.updateEvent.run(e.title, e.category, e.description, e.includes, e.venue, e.setup, e.date, e.startTime, e.endTime,
        e.capacity, e.price, e.priceNote, e.registration, e.visibility, e.organizer, e.contactEmail, e.contactPhone,
        e.poster, e.sampleNote, row.id);
      const event = toEvent(stmt.byId.get(row.id));
      const moved = row.date !== e.date || row.start_time !== e.startTime || row.venue !== e.venue;
      if (moved) {
        for (const r of stmt.registrations.all(row.id)) {
          if (r.status !== 'Registered') continue;
          notify(r.reference, r.email, 'Event Update', `Schedule change: ${event.title}`,
            `${event.title} now takes place on ${event.date}, ${event.startTime}–${event.endTime} at ${event.venueName}. Your registration ${r.reference} remains valid.`);
        }
      }
      return event;
    });
  }

  function setStatus(id, status) {
    if (!EVENT_STATUSES.includes(status)) throw new AppError(`Status must be one of: ${EVENT_STATUSES.join(', ')}.`);
    if (status === 'Cancelled') return cancelEvent(id);
    return transaction(db, () => {
      const row = getRow(id);
      if (row.status === 'Cancelled') throw new AppError('A cancelled event cannot be reopened. Create a new event instead.', 409);
      if (status === 'Pending') throw new AppError('Events cannot be moved back to Pending.', 409);
      if (BLOCKING.includes(status)) {
        assertNoConflict({ venue: row.venue, date: row.date, startTime: row.start_time, endTime: row.end_time }, row.id);
      }
      stmt.setStatus.run(status, row.id);
      const event = toEvent(stmt.byId.get(row.id));
      if (row.status === 'Pending' && status === 'Scheduled') {
        notify(event.code, row.contact_email, 'Venue Confirmed', `Venue booking confirmed: ${event.title}`,
          `${event.venueName} is confirmed for ${event.date}, ${event.startTime}–${event.endTime}. Our events team will contact you about the details (simulation, no payment is taken).`);
      }
      return event;
    });
  }

  function cancelEvent(id) {
    return transaction(db, () => {
      const row = getRow(id);
      if (row.status === 'Cancelled') throw new AppError('This event is already cancelled.', 409);
      if (row.status === 'Completed') throw new AppError('A completed event cannot be cancelled.', 409);
      stmt.setStatus.run('Cancelled', row.id);
      for (const r of stmt.registrations.all(row.id)) {
        if (r.status !== 'Registered') continue;
        stmt.cancelReg.run(r.id);
        notify(r.reference, r.email, 'Event Cancelled', `Cancelled: ${row.title}`,
          `We are sorry: ${row.title} on ${row.date} has been cancelled. Your registration ${r.reference} is void and nothing is charged (simulation).`);
      }
      if (row.contact_email) {
        notify(row.code, row.contact_email, 'Event Cancelled', `Venue booking cancelled: ${row.title}`,
          `The booking of ${venueByCode(row.venue)?.name ?? row.venue} on ${row.date} (${row.start_time}–${row.end_time}) has been cancelled.`);
      }
      return toEvent(stmt.byId.get(row.id));
    });
  }

  function listEvents({ q, venue, category, status, from, to, publicOnly = false } = {}) {
    const where = [];
    const params = [];
    if (publicOnly) where.push("visibility = 'public' AND status <> 'Pending'");
    if (venue) { where.push('venue = ?'); params.push(String(venue).toUpperCase()); }
    if (category) { where.push('category = ?'); params.push(category); }
    if (status && EVENT_STATUSES.includes(status)) { where.push('status = ?'); params.push(status); }
    if (from && isValidDate(from)) { where.push('date >= ?'); params.push(from); }
    if (to && isValidDate(to)) { where.push('date <= ?'); params.push(to); }
    if (q) {
      where.push('(title LIKE ? OR description LIKE ? OR code LIKE ? OR organizer LIKE ?)');
      const like = `%${String(q).trim()}%`;
      params.push(like, like, like, like);
    }
    const sql = `SELECT * FROM events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date, start_time`;
    return db.prepare(sql).all(...params).map((r) => toEvent(r, { withPrivate: !publicOnly }));
  }

  function getPublicEvent(id) {
    const row = getRow(id);
    if (row.visibility !== 'public' || row.status === 'Pending') throw new AppError('Event not found.', 404);
    return toEvent(row, { withPrivate: false });
  }

  function getEvent(id) {
    const row = getRow(id);
    return { ...toEvent(row), registrations: stmt.registrations.all(row.id).map(toRegistration) };
  }

  /** Upcoming bookings of a venue; private events are listed without their details. */
  function venueSchedule(venueCode, { limit = 8 } = {}) {
    const venue = venueByCode(String(venueCode).toUpperCase());
    if (!venue) throw new AppError('Venue not found.', 404);
    const n = now();
    return db.prepare(`SELECT * FROM events WHERE venue = ? AND status IN ('Scheduled', 'Ongoing') AND date >= ? ORDER BY date, start_time`)
      .all(venue.code, n.date)
      .map((r) => toEvent(r, { withPrivate: false }))
      .filter((e) => e.phase !== 'Completed')
      .slice(0, limit)
      .map((e) => (e.visibility === 'private'
        ? { id: null, title: `Private ${e.category.toLowerCase()} event`, category: e.category, date: e.date, startTime: e.startTime, endTime: e.endTime, setupLabel: e.setupLabel, phase: e.phase, visibility: 'private' }
        : e));
  }

  /** Time ranges already held at a venue on one date, without any event details. */
  function bookedSlots(venueCode, date) {
    const venue = venueByCode(String(venueCode).toUpperCase());
    if (!venue) throw new AppError('Venue not found.', 404);
    if (!isValidDate(date)) throw new AppError('Choose a valid date.', 400, { date: 'Choose a valid date.' });
    return db.prepare(`SELECT start_time, end_time FROM events WHERE venue = ? AND date = ?
        AND status IN (${BLOCKING.map((s) => `'${s}'`).join(', ')}) ORDER BY start_time`)
      .all(venue.code, date)
      .map((r) => ({ startTime: r.start_time, endTime: r.end_time }));
  }

  // ---------- registrations ----------

  function toRegistration(r) {
    return {
      id: r.id, reference: r.reference, eventId: r.event_id, firstName: r.first_name, lastName: r.last_name,
      email: r.email, phone: r.phone, tickets: r.tickets, amount: r.amount, notes: r.notes, status: r.status,
      createdAt: r.created_at, cancelledAt: r.cancelled_at,
    };
  }

  function register(eventId, input) {
    return transaction(db, () => {
      const row = getRow(eventId);
      const event = toEvent(row, { withPrivate: false });
      if (row.visibility !== 'public' || row.status === 'Pending') throw new AppError('Event not found.', 404);
      if (event.registration !== 'open') throw new AppError('This event does not take online registrations.', 409);
      if (event.phase !== 'Upcoming') throw new AppError(`Registration is closed: this event is ${event.phase.toLowerCase()}.`, 409);
      const guest = validateGuest(input);
      const tickets = Number(input.tickets ?? 1);
      if (!Number.isInteger(tickets) || tickets < 1 || tickets > MAX_TICKETS) {
        throw new AppError('Please correct the highlighted details.', 400, { tickets: `Choose between 1 and ${MAX_TICKETS} places.` });
      }
      if (stmt.duplicateReg.get(row.id, guest.email)) throw new AppError('This email address is already registered for this event.', 409, { email: 'Already registered for this event.' });
      if (tickets > event.remaining) {
        throw new AppError(event.remaining ? `Only ${event.remaining} place${event.remaining === 1 ? '' : 's'} left for this event.` : 'This event is fully booked.', 409, { tickets: 'Not enough places left.' });
      }
      const ref = newCode('REG-', 6, stmt.refExists);
      const amount = tickets * event.price;
      const { lastInsertRowid } = stmt.insertReg.run(ref, row.id, guest.firstName, guest.lastName, guest.email, guest.phone, tickets, amount, clean(input.notes).slice(0, 300));
      notify(ref, guest.email, 'Event Registration', `You're registered: ${event.title}`,
        `Dear ${guest.firstName}, your registration ${ref} for ${event.title} on ${event.date} (${event.startTime}–${event.endTime}) at ${event.venueName} is confirmed for ${tickets} place${tickets === 1 ? '' : 's'}. ${amount ? `Amount due on arrival: ${peso(amount)} (simulation, nothing is charged).` : 'Admission is free.'}`);
      return { registration: toRegistration(stmt.regById.get(lastInsertRowid)), event: toEvent(row, { withPrivate: false }) };
    });
  }

  function cancelRegistrationByGuest(reference, email) {
    const r = stmt.regByRef.get(String(reference ?? '').trim().toUpperCase());
    if (!r || r.email.toLowerCase() !== String(email ?? '').trim().toLowerCase()) throw new AppError('No registration matches that reference and email address.', 404);
    return cancelRegistration(r.id);
  }

  function cancelRegistration(id) {
    return transaction(db, () => {
      const r = stmt.regById.get(Number(id));
      if (!r) throw new AppError('Registration not found.', 404);
      if (r.status === 'Cancelled') throw new AppError('This registration is already cancelled.', 409);
      stmt.cancelReg.run(r.id);
      const row = stmt.byId.get(r.event_id);
      notify(r.reference, r.email, 'Registration Cancelled', `Registration cancelled: ${row.title}`,
        `Your registration ${r.reference} for ${row.title} on ${row.date} has been cancelled and the place released.`);
      return toRegistration(stmt.regById.get(r.id));
    });
  }

  // ---------- venue requests (guest "Book This Venue") ----------

  function requestVenue(input) {
    const guest = validateGuest({ firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone });
    const event = createEvent({
      ...input,
      organizer: `${guest.firstName} ${guest.lastName}`,
      contactEmail: guest.email,
      contactPhone: guest.phone,
      visibility: 'private',
      registration: 'none',
      price: 0,
      priceNote: '',
      poster: { Wedding: 'wedding', Birthday: 'birthday', Corporate: 'corporate', Gala: 'gala', Banquet: 'gala' }[clean(input.category)] ?? 'gala',
    }, { status: 'Pending', maskConflicts: true });
    notify(event.code, guest.email, 'Venue Request', `Venue request received: ${event.title}`,
      `We received your request for ${event.venueName} on ${event.date}, ${event.startTime}–${event.endTime} (${event.capacity} guests). The time slot is held while our events team reviews it (simulation, no payment is taken).`);
    return event;
  }

  return {
    venues: () => VENUES,
    createEvent, updateEvent, setStatus, cancelEvent, listEvents, getEvent, getPublicEvent, venueSchedule, bookedSlots,
    findConflicts, register, cancelRegistration, cancelRegistrationByGuest, requestVenue,
  };
}
