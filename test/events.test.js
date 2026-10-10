import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { createReservationService } from '../server/reservations.js';
import { createEventService } from '../server/events.js';
import { seedIfEmpty, seedEventsIfEmpty } from '../server/seed.js';
import { addDays, today } from '../server/dates.js';

const D = (n) => addDays(today(), n);

function setup(time = '12:00') {
  const db = openDatabase(':memory:');
  const events = createEventService(db, { now: () => ({ date: today(), time }) });
  return { db, events };
}

const base = (o = {}) => ({
  title: 'Test Event', category: 'Music', venue: 'THEATER', date: D(5),
  startTime: '18:00', endTime: '20:00', capacity: 10, price: 500, registration: 'open', visibility: 'public', ...o,
});

let n = 0;
const attendee = (o = {}) => ({ firstName: 'Ana', lastName: `Test${++n}`, email: `attendee${n}@example.com`, phone: '+63 900 000 0000', tickets: 1, ...o });

test('overlapping events in the same venue are rejected', () => {
  const { events } = setup();
  events.createEvent(base());
  assert.throws(() => events.createEvent(base({ startTime: '19:00', endTime: '21:00' })), (e) => e.status === 409);
  assert.throws(() => events.createEvent(base({ startTime: '17:00', endTime: '18:30' })), (e) => e.status === 409);
  assert.throws(() => events.createEvent(base({ startTime: '18:30', endTime: '19:30' })), (e) => e.status === 409);
});

test('back-to-back events, other venues and other dates do not conflict', () => {
  const { events } = setup();
  events.createEvent(base());
  assert.ok(events.createEvent(base({ startTime: '20:00', endTime: '22:00' })));
  assert.ok(events.createEvent(base({ startTime: '16:00', endTime: '18:00' })));
  assert.ok(events.createEvent(base({ venue: 'STUDIO', capacity: 10 })));
  assert.ok(events.createEvent(base({ date: D(6) })));
});

test('cancelled events release the venue; pending venue requests hold it', () => {
  const { events } = setup();
  const e = events.createEvent(base());
  events.cancelEvent(e.id);
  assert.ok(events.createEvent(base()));
  events.requestVenue({ title: 'Debut', category: 'Birthday', venue: 'BALLROOM', setup: 'wedding', date: D(8), startTime: '18:00', endTime: '22:00', capacity: 100, firstName: 'A', lastName: 'B', email: 'ab@example.com', phone: '+63 900 000 0001' });
  assert.throws(() => events.createEvent(base({ venue: 'BALLROOM', setup: 'banquet', date: D(8), capacity: 100 })), (err) => err.status === 409);
});

test('editing re-checks conflicts but never conflicts with itself', () => {
  const { events } = setup();
  const a = events.createEvent(base());
  events.createEvent(base({ startTime: '20:00', endTime: '22:00' }));
  assert.ok(events.updateEvent(a.id, base({ title: 'Renamed', endTime: '19:30' })));
  assert.throws(() => events.updateEvent(a.id, base({ endTime: '21:00' })), (e) => e.status === 409);
});

test('validates dates, times, venue capacity and setups', () => {
  const { events } = setup();
  assert.throws(() => events.createEvent(base({ date: D(-1) })), (e) => !!e.details?.date);
  assert.throws(() => events.createEvent(base({ endTime: '17:00' })), (e) => !!e.details?.endTime);
  assert.throws(() => events.createEvent(base({ capacity: 999 })), (e) => !!e.details?.capacity);
  assert.throws(() => events.createEvent(base({ venue: 'BALLROOM', capacity: 50 })), (e) => !!e.details?.setup);
  assert.throws(() => events.createEvent(base({ venue: 'BALLROOM', setup: 'wedding', capacity: 500 })), (e) => !!e.details?.capacity);
  assert.throws(() => events.createEvent(base({ venue: 'NOWHERE' })), (e) => !!e.details?.venue);
});

test('registration tracks capacity and prevents overbooking and duplicates', () => {
  const { events } = setup();
  const e = events.createEvent(base({ capacity: 5 }));
  const first = events.register(e.id, attendee({ tickets: 3, email: 'dup@example.com' }));
  assert.match(first.registration.reference, /^REG-[A-Z0-9]{6}$/);
  assert.equal(first.registration.amount, 1500);
  assert.equal(first.event.remaining, 2);
  assert.throws(() => events.register(e.id, attendee({ email: 'dup@example.com' })), (err) => err.status === 409);
  assert.throws(() => events.register(e.id, attendee({ tickets: 3 })), (err) => err.status === 409);
  events.register(e.id, attendee({ tickets: 2 }));
  assert.equal(events.getEvent(e.id).remaining, 0);
  assert.throws(() => events.register(e.id, attendee()), /fully booked/);
  events.cancelRegistration(first.registration.id);
  assert.equal(events.getEvent(e.id).remaining, 3);
  assert.throws(() => events.updateEvent(e.id, base({ capacity: 1 })), (err) => !!err.details?.capacity);
});

test('registration is closed for past, ongoing, private and invite-only events', () => {
  const { events } = setup('19:00');
  const ongoing = events.createEvent(base({ date: today(), startTime: '18:00', endTime: '20:00' }));
  assert.equal(events.getEvent(ongoing.id).phase, 'Ongoing');
  assert.throws(() => events.register(ongoing.id, attendee()), /closed/);
  const invite = events.createEvent(base({ registration: 'invite', venue: 'STUDIO' }));
  assert.throws(() => events.register(invite.id, attendee()), /does not take online registrations/);
  const priv = events.createEvent(base({ visibility: 'private', venue: 'PLAZA' }));
  assert.throws(() => events.register(priv.id, attendee()), (err) => err.status === 404);
});

test('cancelling an event voids registrations and records notifications', () => {
  const { db, events } = setup();
  const e = events.createEvent(base());
  events.register(e.id, attendee());
  events.cancelEvent(e.id);
  const regs = events.getEvent(e.id).registrations;
  assert.ok(regs.every((r) => r.status === 'Cancelled'));
  const types = db.prepare('SELECT type FROM notifications').all().map((r) => r.type);
  assert.deepEqual(types, ['Event Registration', 'Event Cancelled']);
  assert.throws(() => events.setStatus(e.id, 'Scheduled'), (err) => err.status === 409);
});

test('approving a venue request re-checks conflicts', () => {
  const { events } = setup();
  const req = events.requestVenue({ title: 'Wedding', category: 'Wedding', venue: 'BALLROOM', setup: 'wedding', date: D(9), startTime: '17:00', endTime: '22:00', capacity: 200, firstName: 'A', lastName: 'B', email: 'ab@example.com', phone: '+63 900 000 0001' });
  assert.equal(req.status, 'Pending');
  assert.equal(req.visibility, 'private');
  assert.equal(events.setStatus(req.id, 'Scheduled').status, 'Scheduled');
  assert.equal(events.listEvents({ publicOnly: true }).length, 0);
});

test('guest venue requests see booked slots but not private event details', () => {
  const { events } = setup();
  events.createEvent(base({ title: 'Secret Wedding', category: 'Wedding', venue: 'BALLROOM', setup: 'wedding', capacity: 200, visibility: 'private', registration: 'invite' }));
  assert.deepEqual(events.bookedSlots('ballroom', D(5)), [{ startTime: '18:00', endTime: '20:00' }]);
  assert.deepEqual(events.bookedSlots('BALLROOM', D(6)), []);
  assert.throws(() => events.bookedSlots('BALLROOM', 'not-a-date'), (e) => e.status === 400);
  const request = { title: 'Reunion', category: 'Other', venue: 'BALLROOM', setup: 'banquet', date: D(5), startTime: '19:00', endTime: '22:00', capacity: 80, firstName: 'A', lastName: 'B', email: 'ab@example.com', phone: '+63 900 000 0001' };
  assert.throws(() => events.requestVenue(request), (e) => e.status === 409 && !e.message.includes('Secret') && e.message.includes('18:00'));
  assert.throws(() => events.createEvent(base({ venue: 'BALLROOM', setup: 'banquet', capacity: 80 })), (e) => e.message.includes('Secret Wedding'));
});

test('sample events seed without conflicts and include the Bakebe workshop', () => {
  const db = openDatabase(':memory:');
  const service = createReservationService(db);
  const events = createEventService(db);
  seedIfEmpty(db, service);
  assert.ok(seedEventsIfEmpty(db, events));
  const all = events.listEvents({ publicOnly: true });
  const bakebe = all.find((e) => e.title === 'Bakebe DIY Cake-Baking Workshop');
  assert.ok(bakebe);
  assert.equal(bakebe.price, 999);
  assert.match(bakebe.date, /-09-30$/);
  assert.ok(bakebe.date >= today());
  assert.match(bakebe.sampleNote, /Not an official partnership/);
  const rooms = db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n;
  assert.equal(rooms, 20);
  assert.equal(seedEventsIfEmpty(db, events), false);
});
