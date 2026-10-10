import { randomInt } from 'node:crypto';
import { transaction } from './db.js';
import { BLOCKING_STATUSES, ROOM_TYPES, TOTAL_ROOMS, getRoomType } from './inventory.js';
import { addDays, nightsBetween, today } from './dates.js';
import {
  AppError,
  validateDateRange,
  validateGuest,
  validateStatus,
  validateStay,
} from './validation.js';

const BLOCKING_SQL = BLOCKING_STATUSES.map((s) => `'${s}'`).join(', ');
const EDITABLE_STATUSES = ['Pending', 'Confirmed', 'Checked In'];
const CANCELLABLE_STATUSES = ['Pending', 'Confirmed'];

const RESERVATION_SELECT = `
  SELECT res.*, g.first_name, g.last_name, g.email, g.phone, r.number AS room_number
  FROM reservations res
  JOIN guests g ON g.id = res.guest_id
  JOIN rooms r ON r.id = res.room_id
`;

function toReservation(row) {
  if (!row) return null;
  const type = getRoomType(row.category);
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    category: row.category,
    categoryName: type?.name ?? row.category,
    roomNumber: row.room_number,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: nightsBetween(row.check_in, row.check_out),
    guests: row.guests,
    specialRequests: row.special_requests,
    nightlyRate: row.nightly_rate,
    totalAmount: row.total_amount,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    guest: {
      id: row.guest_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
    },
  };
}

function peso(amount) {
  return `PHP ${Number(amount).toLocaleString('en-US')}`;
}

export function createReservationService(db) {
  const stmt = {
    freeRooms: db.prepare(`
      SELECT r.id, r.number FROM rooms r
      WHERE r.category = ?
        AND NOT EXISTS (
          SELECT 1 FROM reservations x
          WHERE x.room_id = r.id
            AND x.status IN (${BLOCKING_SQL})
            AND x.id <> ?
            AND x.check_in < ? AND ? < x.check_out
        )
      ORDER BY r.number
    `),
    roomByNumber: db.prepare('SELECT * FROM rooms WHERE number = ?'),
    roomById: db.prepare('SELECT * FROM rooms WHERE id = ?'),
    occupiedOn: db.prepare(`
      SELECT r.category, COUNT(DISTINCT res.room_id) AS occupied
      FROM reservations res JOIN rooms r ON r.id = res.room_id
      WHERE res.status IN (${BLOCKING_SQL}) AND res.check_in <= ? AND ? < res.check_out
      GROUP BY r.category
    `),
    guestByEmail: db.prepare('SELECT * FROM guests WHERE email = ?'),
    guestById: db.prepare('SELECT * FROM guests WHERE id = ?'),
    insertGuest: db.prepare('INSERT INTO guests (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)'),
    updateGuest: db.prepare(`
      UPDATE guests SET first_name = ?, last_name = ?, email = ?, phone = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `),
    refExists: db.prepare('SELECT 1 FROM reservations WHERE reference = ?'),
    insertReservation: db.prepare(`
      INSERT INTO reservations (reference, guest_id, room_id, category, check_in, check_out,
        guests, status, special_requests, nightly_rate, total_amount, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateStay: db.prepare(`
      UPDATE reservations SET room_id = ?, category = ?, check_in = ?, check_out = ?, guests = ?,
        special_requests = ?, nightly_rate = ?, total_amount = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `),
    updateStatus: db.prepare(`
      UPDATE reservations SET status = ?, room_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
    `),
    byId: db.prepare(`${RESERVATION_SELECT} WHERE res.id = ?`),
    byReference: db.prepare(`${RESERVATION_SELECT} WHERE res.reference = ?`),
    insertNotification: db.prepare(`
      INSERT INTO notifications (reservation_id, reference, recipient, type, subject, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
  };

  // ---------- availability ----------

  function freeRoomsFor(category, checkIn, checkOut, excludeId = 0) {
    return stmt.freeRooms.all(category, excludeId, checkOut, checkIn);
  }

  function getAvailability(checkIn, checkOut) {
    validateDateRange(checkIn, checkOut);
    return ROOM_TYPES.map((type) => {
      const available = freeRoomsFor(type.code, checkIn, checkOut).length;
      return {
        ...type,
        total: type.roomCount,
        available,
        booked: type.roomCount - available,
      };
    });
  }

  function freeRoomNumbers(category, checkIn, checkOut, excludeId = 0) {
    validateDateRange(checkIn, checkOut);
    if (!getRoomType(category)) throw new AppError('Select a valid room category.');
    return freeRoomsFor(category, checkIn, checkOut, Number(excludeId) || 0).map((r) => r.number);
  }

  function occupancyOn(date) {
    const rows = stmt.occupiedOn.all(date, date);
    return ROOM_TYPES.map((type) => {
      const occupied = rows.find((r) => r.category === type.code)?.occupied ?? 0;
      return { code: type.code, name: type.name, total: type.roomCount, occupied, available: type.roomCount - occupied };
    });
  }

  /**
   * Picks a room that is free for the whole stay. Keeps `preferredRoomId` when
   * it still fits, honours an explicit staff room choice, and otherwise takes
   * the lowest-numbered free room in the category.
   */
  function assignRoom({ category, checkIn, checkOut, excludeId = 0, preferredRoomId, roomNumber }) {
    const free = freeRoomsFor(category, checkIn, checkOut, excludeId);
    const type = getRoomType(category);

    if (roomNumber) {
      const room = stmt.roomByNumber.get(String(roomNumber));
      if (!room) throw new AppError(`Room ${roomNumber} does not exist.`, 400, { roomNumber: 'Unknown room.' });
      if (room.category !== category) {
        throw new AppError(`Room ${roomNumber} is not a ${type.name}.`, 400, { roomNumber: 'Room is in a different category.' });
      }
      if (!free.some((r) => r.id === room.id)) {
        throw new AppError(`Room ${roomNumber} is already reserved for part of those dates.`, 409, {
          roomNumber: 'Room has a conflicting reservation.',
        });
      }
      return room.id;
    }

    if (preferredRoomId && free.some((r) => r.id === preferredRoomId)) return preferredRoomId;
    if (!free.length) {
      throw new AppError(
        `Sorry, no ${type.name}s are available from ${checkIn} to ${checkOut}. Please choose other dates or another room category.`,
        409,
      );
    }
    return free[0].id;
  }

  // ---------- helpers ----------

  function generateReference() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ref;
    do {
      ref = 'HRY-' + Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    } while (stmt.refExists.get(ref));
    return ref;
  }

  function upsertGuestByEmail(guest) {
    const existing = stmt.guestByEmail.get(guest.email);
    if (existing) {
      stmt.updateGuest.run(guest.firstName, guest.lastName, guest.email, guest.phone, existing.id);
      return existing.id;
    }
    return Number(stmt.insertGuest.run(guest.firstName, guest.lastName, guest.email, guest.phone).lastInsertRowid);
  }

  function notify(reservation, type, subject, message) {
    stmt.insertNotification.run(reservation.id, reservation.reference, reservation.guest.email, type, subject, message);
  }

  function stayLine(r) {
    return `${r.categoryName} (Room ${r.roomNumber}), ${r.checkIn} to ${r.checkOut} - ${r.nights} night(s), ${r.guests} guest(s). Total: ${peso(r.totalAmount)}.`;
  }

  function mustGet(id) {
    const r = toReservation(stmt.byId.get(Number(id)));
    if (!r) throw new AppError('Reservation not found.', 404);
    return r;
  }

  // ---------- reservations ----------

  /**
   * Creates a reservation. Guests are matched by email so returning guests
   * keep a single profile. Staff may pass `guestId`, a specific `roomNumber`,
   * an initial `status`, and may record stays that started in the past.
   */
  function createReservation(input, { actor = 'Guest' } = {}) {
    const isStaff = actor === 'Staff';
    const stay = validateStay(input, { allowPastCheckIn: isStaff });
    const status = isStaff && input.status ? validateStatus(input.status) : 'Confirmed';
    if (!['Pending', 'Confirmed'].includes(status)) {
      throw new AppError('New reservations must start as Pending or Confirmed.');
    }

    return transaction(db, () => {
      let guestId;
      if (isStaff && input.guestId) {
        const g = stmt.guestById.get(Number(input.guestId));
        if (!g) throw new AppError('Selected guest was not found.', 404);
        guestId = g.id;
      } else {
        guestId = upsertGuestByEmail(validateGuest(input));
      }

      const roomId = assignRoom({ ...stay, roomNumber: isStaff ? input.roomNumber : undefined });
      const rate = getRoomType(stay.category).rate;
      const total = rate * nightsBetween(stay.checkIn, stay.checkOut);
      const reference = generateReference();

      const { lastInsertRowid } = stmt.insertReservation.run(
        reference, guestId, roomId, stay.category, stay.checkIn, stay.checkOut,
        stay.guests, status, stay.specialRequests, rate, total, actor,
      );
      const reservation = mustGet(lastInsertRowid);
      const heading = status === 'Pending' ? 'Reservation received (pending confirmation)' : 'Booking confirmed';
      notify(
        reservation,
        'Booking Confirmation',
        `${heading} - ${reference}`,
        `Dear ${reservation.guest.firstName}, your reservation ${reference} is ${status.toLowerCase()}. ${stayLine(reservation)} No payment has been collected (simulation).`,
      );
      return reservation;
    });
  }

  function updateReservation(id, input, { actor = 'Guest' } = {}) {
    const isStaff = actor === 'Staff';
    return transaction(db, () => {
      const current = mustGet(id);
      const allowed = isStaff ? EDITABLE_STATUSES : CANCELLABLE_STATUSES;
      if (!allowed.includes(current.status)) {
        throw new AppError(`A ${current.status.toLowerCase()} reservation can no longer be modified.`, 409);
      }

      const stay = validateStay(
        {
          category: input.category ?? current.category,
          checkIn: input.checkIn ?? current.checkIn,
          checkOut: input.checkOut ?? current.checkOut,
          guests: input.guests ?? current.guests,
          specialRequests: input.specialRequests ?? current.specialRequests,
        },
        // Staff may edit stays that are already in progress.
        { allowPastCheckIn: isStaff },
      );

      const roomId = assignRoom({
        ...stay,
        excludeId: current.id,
        preferredRoomId: stay.category === current.category ? stmt.roomByNumber.get(current.roomNumber).id : undefined,
        roomNumber: isStaff && input.roomNumber && input.roomNumber !== current.roomNumber ? input.roomNumber : undefined,
      });
      const rate = getRoomType(stay.category).rate;
      const total = rate * nightsBetween(stay.checkIn, stay.checkOut);

      stmt.updateStay.run(roomId, stay.category, stay.checkIn, stay.checkOut, stay.guests, stay.specialRequests, rate, total, current.id);
      const updated = mustGet(current.id);
      notify(
        updated,
        'Booking Modified',
        `Reservation updated - ${updated.reference}`,
        `Dear ${updated.guest.firstName}, your reservation ${updated.reference} has been updated by ${isStaff ? 'our front desk' : 'you'}. New details: ${stayLine(updated)}`,
      );
      return updated;
    });
  }

  function cancelReservation(id, { actor = 'Guest' } = {}) {
    return transaction(db, () => {
      const current = mustGet(id);
      if (!CANCELLABLE_STATUSES.includes(current.status)) {
        throw new AppError(`A ${current.status.toLowerCase()} reservation cannot be cancelled.`, 409);
      }
      stmt.updateStatus.run('Cancelled', stmt.roomByNumber.get(current.roomNumber).id, current.id);
      const updated = mustGet(current.id);
      notify(
        updated,
        'Booking Cancelled',
        `Cancellation confirmed - ${updated.reference}`,
        `Dear ${updated.guest.firstName}, reservation ${updated.reference} (${updated.categoryName}, ${updated.checkIn} to ${updated.checkOut}) has been cancelled${actor === 'Staff' ? ' by our front desk' : ''}. The room has been released. No charges apply (simulation).`,
      );
      return updated;
    });
  }

  /**
   * Staff status changes. Moving a reservation back into a room-holding status
   * (e.g. reinstating a cancellation) re-checks availability so it can never
   * double-book a room.
   */
  function setStatus(id, status) {
    validateStatus(status);
    return transaction(db, () => {
      const current = mustGet(id);
      if (current.status === status) return current;
      const now = today();

      if (status === 'Checked In') {
        if (now < current.checkIn) throw new AppError(`Guest cannot check in before the check-in date (${current.checkIn}).`, 409);
        if (now >= current.checkOut) throw new AppError('This stay has already ended; it cannot be checked in.', 409);
      }
      if (status === 'Checked Out' && current.status !== 'Checked In') {
        throw new AppError('Only checked-in reservations can be checked out.', 409);
      }

      let roomId = stmt.roomByNumber.get(current.roomNumber).id;
      const wasBlocking = BLOCKING_STATUSES.includes(current.status);
      const willBlock = BLOCKING_STATUSES.includes(status);
      if (!wasBlocking && willBlock) {
        roomId = assignRoom({
          category: current.category,
          checkIn: current.checkIn,
          checkOut: current.checkOut,
          excludeId: current.id,
          preferredRoomId: roomId,
        });
      }

      stmt.updateStatus.run(status, roomId, current.id);
      const updated = mustGet(current.id);
      const type = status === 'Cancelled' ? 'Booking Cancelled' : 'Status Update';
      notify(
        updated,
        type,
        `Reservation ${status.toLowerCase()} - ${updated.reference}`,
        `Dear ${updated.guest.firstName}, the status of reservation ${updated.reference} changed from ${current.status} to ${status}. ${stayLine(updated)}`,
      );
      return updated;
    });
  }

  function getReservation(id) {
    return mustGet(id);
  }

  function findForGuest(reference, email) {
    const ref = String(reference ?? '').trim().toUpperCase();
    const mail = String(email ?? '').trim().toLowerCase();
    if (!ref || !mail) throw new AppError('Enter your booking reference and email address.');
    const r = toReservation(stmt.byReference.get(ref));
    if (!r || r.guest.email.toLowerCase() !== mail) {
      throw new AppError('No reservation matches that booking reference and email address.', 404);
    }
    return r;
  }

  function listReservations({ q, category, status, from, to } = {}) {
    const where = [];
    const params = [];
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      where.push(`(res.reference LIKE ? OR g.first_name LIKE ? OR g.last_name LIKE ?
        OR (g.first_name || ' ' || g.last_name) LIKE ? OR g.email LIKE ? OR g.phone LIKE ?)`);
      params.push(like, like, like, like, like, like);
    }
    if (category) { where.push('res.category = ?'); params.push(category); }
    if (status) { where.push('res.status = ?'); params.push(status); }
    // Stay overlaps the inclusive [from, to] window.
    if (from) { where.push('res.check_out > ?'); params.push(from); }
    if (to) { where.push('res.check_in <= ?'); params.push(to); }
    const sql = `${RESERVATION_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY res.check_in DESC, res.id DESC`;
    return db.prepare(sql).all(...params).map(toReservation);
  }

  function notificationsFor(reservationId) {
    return db.prepare('SELECT * FROM notifications WHERE reservation_id = ? ORDER BY id DESC').all(reservationId);
  }

  function recentNotifications(limit = 10) {
    return db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT ?').all(limit);
  }

  // ---------- guests ----------

  function listGuests(q) {
    const like = `%${(q ?? '').trim()}%`;
    return db.prepare(`
      SELECT g.*,
        COUNT(res.id) AS total_reservations,
        SUM(CASE WHEN res.status IN (${BLOCKING_SQL}) THEN 1 ELSE 0 END) AS active_reservations,
        MAX(res.check_in) AS last_check_in
      FROM guests g LEFT JOIN reservations res ON res.guest_id = g.id
      WHERE (g.first_name || ' ' || g.last_name) LIKE ? OR g.email LIKE ? OR g.phone LIKE ?
      GROUP BY g.id
      ORDER BY g.last_name, g.first_name
    `).all(like, like, like).map((g) => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      email: g.email,
      phone: g.phone,
      createdAt: g.created_at,
      totalReservations: g.total_reservations,
      activeReservations: g.active_reservations ?? 0,
      lastCheckIn: g.last_check_in,
    }));
  }

  function getGuest(id) {
    const g = stmt.guestById.get(Number(id));
    if (!g) throw new AppError('Guest not found.', 404);
    const reservations = db.prepare(`${RESERVATION_SELECT} WHERE res.guest_id = ? ORDER BY res.check_in DESC`)
      .all(g.id).map(toReservation);
    return { id: g.id, firstName: g.first_name, lastName: g.last_name, email: g.email, phone: g.phone, createdAt: g.created_at, reservations };
  }

  function updateGuest(id, input) {
    const guest = validateGuest(input);
    return transaction(db, () => {
      const existing = stmt.guestById.get(Number(id));
      if (!existing) throw new AppError('Guest not found.', 404);
      const clash = stmt.guestByEmail.get(guest.email);
      if (clash && clash.id !== existing.id) {
        throw new AppError('Another guest already uses that email address.', 409, { email: 'Email already in use.' });
      }
      stmt.updateGuest.run(guest.firstName, guest.lastName, guest.email, guest.phone, existing.id);
      return getGuest(existing.id);
    });
  }

  // ---------- staff overviews ----------

  function dashboard(date = today()) {
    const byCategory = occupancyOn(date);
    const occupied = byCategory.reduce((s, c) => s + c.occupied, 0);
    const statusCounts = Object.fromEntries(
      db.prepare('SELECT status, COUNT(*) AS n FROM reservations GROUP BY status').all().map((r) => [r.status, r.n]),
    );
    const activeReservations = db.prepare(
      `SELECT COUNT(*) AS n FROM reservations WHERE status IN (${BLOCKING_SQL}) AND check_out > ?`,
    ).get(date).n;
    const arrivals = db.prepare(`${RESERVATION_SELECT} WHERE res.check_in = ? AND res.status IN (${BLOCKING_SQL}) ORDER BY r.number`)
      .all(date).map(toReservation);
    const departures = db.prepare(`${RESERVATION_SELECT} WHERE res.check_out = ? AND res.status IN ('Checked In', 'Checked Out', 'Confirmed', 'Pending') ORDER BY r.number`)
      .all(date).map(toReservation);
    return {
      date,
      totalRooms: TOTAL_ROOMS,
      occupied,
      available: TOTAL_ROOMS - occupied,
      activeReservations,
      byCategory,
      statusCounts,
      arrivals,
      departures,
      notifications: recentNotifications(8),
    };
  }

  function roomTimeline(start = today(), days = 14) {
    const end = addDays(start, days);
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY number').all();
    const bookings = db.prepare(`${RESERVATION_SELECT}
      WHERE res.status IN (${BLOCKING_SQL}) AND res.check_in < ? AND ? < res.check_out
      ORDER BY res.check_in`).all(end, start).map(toReservation);
    const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
    const now = today();
    return {
      start,
      days,
      dates,
      groups: ROOM_TYPES.map((type) => ({
        code: type.code,
        name: type.name,
        rate: type.rate,
        rooms: rooms.filter((r) => r.category === type.code).map((room) => {
          const roomBookings = bookings.filter((b) => b.roomNumber === room.number);
          const current = roomBookings.find((b) => b.checkIn <= now && now < b.checkOut);
          return {
            number: room.number,
            status: current ? (current.status === 'Checked In' ? 'Occupied' : 'Reserved') : 'Available',
            currentGuest: current ? `${current.guest.firstName} ${current.guest.lastName}` : null,
            bookings: roomBookings.map((b) => ({
              id: b.id,
              reference: b.reference,
              status: b.status,
              checkIn: b.checkIn,
              checkOut: b.checkOut,
              guestName: `${b.guest.firstName} ${b.guest.lastName}`,
            })),
          };
        }),
      })),
    };
  }

  return {
    getAvailability,
    freeRoomNumbers,
    occupancyOn,
    createReservation,
    updateReservation,
    cancelReservation,
    setStatus,
    getReservation,
    findForGuest,
    listReservations,
    notificationsFor,
    recentNotifications,
    listGuests,
    getGuest,
    updateGuest,
    dashboard,
    roomTimeline,
  };
}
