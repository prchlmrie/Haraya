import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { createReservationService } from '../server/reservations.js';
import { seedIfEmpty } from '../server/seed.js';
import { addDays, today } from '../server/dates.js';

function setup({ seed = false } = {}) {
  const db = openDatabase(':memory:');
  const service = createReservationService(db);
  if (seed) seedIfEmpty(db, service);
  return { db, service };
}

const D = (n) => addDays(today(), n);

let guestCounter = 0;
function booking(overrides = {}) {
  guestCounter++;
  return {
    firstName: 'Test',
    lastName: `Guest${guestCounter}`,
    email: `guest${guestCounter}@example.com`,
    phone: '+63 900 000 0000',
    category: 'ECONOMY',
    checkIn: D(1),
    checkOut: D(3),
    guests: 1,
    ...overrides,
  };
}

test('inventory has exactly 20 rooms: 10 Economy, 6 Deluxe, 4 VIP', () => {
  const { db } = setup();
  const rows = db.prepare('SELECT category, COUNT(*) AS n FROM rooms GROUP BY category').all();
  const counts = Object.fromEntries(rows.map((r) => [r.category, r.n]));
  assert.deepEqual(counts, { ECONOMY: 10, DELUXE: 6, VIP: 4 });
});

test('availability starts at full inventory', () => {
  const { service } = setup();
  const avail = Object.fromEntries(service.getAvailability(D(1), D(2)).map((t) => [t.code, t.available]));
  assert.deepEqual(avail, { ECONOMY: 10, DELUXE: 6, VIP: 4 });
});

test('booking reduces availability and returns a reference', () => {
  const { service } = setup();
  const r = service.createReservation(booking({ category: 'VIP', guests: 2 }));
  assert.match(r.reference, /^HRY-[A-Z0-9]{6}$/);
  assert.equal(r.status, 'Confirmed');
  assert.equal(r.totalAmount, 18000 * 2);
  const vip = service.getAvailability(D(1), D(3)).find((t) => t.code === 'VIP');
  assert.equal(vip.available, 3);
});

test('prevents overbooking a category', () => {
  const { service } = setup();
  for (let i = 0; i < 4; i++) service.createReservation(booking({ category: 'VIP' }));
  assert.throws(() => service.createReservation(booking({ category: 'VIP' })), (err) => err.status === 409);
  const vip = service.getAvailability(D(1), D(3)).find((t) => t.code === 'VIP');
  assert.equal(vip.available, 0);
});

test('never assigns overlapping reservations to the same room', () => {
  const { service, db } = setup();
  for (let i = 0; i < 10; i++) {
    service.createReservation(booking({ checkIn: D(i % 3), checkOut: D((i % 3) + 2) }));
  }
  const overlaps = db.prepare(`
    SELECT COUNT(*) AS n FROM reservations a JOIN reservations b
      ON a.room_id = b.room_id AND a.id < b.id
     AND a.status IN ('Pending','Confirmed','Checked In') AND b.status IN ('Pending','Confirmed','Checked In')
     AND a.check_in < b.check_out AND b.check_in < a.check_out
  `).get().n;
  assert.equal(overlaps, 0);
});

test('check-out date frees the room for a same-day arrival', () => {
  const { service } = setup();
  for (let i = 0; i < 4; i++) service.createReservation(booking({ category: 'VIP', checkIn: D(1), checkOut: D(3) }));
  const next = service.createReservation(booking({ category: 'VIP', checkIn: D(3), checkOut: D(5) }));
  assert.equal(next.status, 'Confirmed');
});

test('cancelled reservations release the room', () => {
  const { service } = setup();
  const made = [];
  for (let i = 0; i < 4; i++) made.push(service.createReservation(booking({ category: 'VIP' })));
  service.cancelReservation(made[0].id);
  const vip = service.getAvailability(D(1), D(3)).find((t) => t.code === 'VIP');
  assert.equal(vip.available, 1);
  assert.ok(service.createReservation(booking({ category: 'VIP' })));
});

test('modifying dates/category re-checks availability and recalculates totals', () => {
  const { service } = setup();
  const r = service.createReservation(booking({ category: 'ECONOMY' }));
  const moved = service.updateReservation(r.id, { category: 'DELUXE', checkIn: D(5), checkOut: D(8), guests: 3 });
  assert.equal(moved.category, 'DELUXE');
  assert.equal(moved.totalAmount, 8500 * 3);
  const avail = Object.fromEntries(service.getAvailability(D(1), D(3)).map((t) => [t.code, t.available]));
  assert.equal(avail.ECONOMY, 10);

  for (let i = 0; i < 4; i++) service.createReservation(booking({ category: 'VIP', checkIn: D(5), checkOut: D(8) }));
  assert.throws(() => service.updateReservation(r.id, { category: 'VIP', guests: 2 }), (err) => err.status === 409);
  assert.equal(service.getReservation(r.id).category, 'DELUXE');
});

test('modifying keeps the reservation from conflicting with itself', () => {
  const { service } = setup();
  for (let i = 0; i < 3; i++) service.createReservation(booking({ category: 'VIP' }));
  const last = service.createReservation(booking({ category: 'VIP' }));
  const extended = service.updateReservation(last.id, { checkOut: D(4) });
  assert.equal(extended.checkOut, D(4));
  assert.equal(extended.roomNumber, last.roomNumber);
});

test('reinstating a cancelled booking is blocked when the category is full', () => {
  const { service } = setup();
  const first = service.createReservation(booking({ category: 'VIP' }));
  service.cancelReservation(first.id);
  for (let i = 0; i < 4; i++) service.createReservation(booking({ category: 'VIP' }));
  assert.throws(() => service.setStatus(first.id, 'Confirmed'), (err) => err.status === 409);
});

test('staff cannot assign a room that is already taken', () => {
  const { service } = setup();
  const a = service.createReservation(booking({ category: 'DELUXE' }), { actor: 'Staff' });
  assert.throws(
    () => service.createReservation(booking({ category: 'DELUXE', roomNumber: a.roomNumber }), { actor: 'Staff' }),
    (err) => err.status === 409,
  );
});

test('validates required fields and date ranges', () => {
  const { service } = setup();
  assert.throws(() => service.createReservation(booking({ firstName: '' })), /guest details/);
  assert.throws(() => service.createReservation(booking({ email: 'not-an-email' })), /guest details/);
  assert.throws(() => service.createReservation(booking({ checkIn: D(3), checkOut: D(3) })), (e) => /after the check-in/.test(e.details.checkOut));
  assert.throws(() => service.createReservation(booking({ checkIn: D(4), checkOut: D(2) })), (e) => /after the check-in/.test(e.details.checkOut));
  assert.throws(() => service.createReservation(booking({ checkIn: D(-2), checkOut: D(1) })), (e) => /past/.test(e.details.checkIn));
  assert.throws(() => service.createReservation(booking({ category: 'ECONOMY', guests: 3 })), (e) => /up to 2/.test(e.details.guests));
});

test('status workflow rules', () => {
  const { service } = setup();
  const future = service.createReservation(booking({ checkIn: D(2), checkOut: D(4) }));
  assert.throws(() => service.setStatus(future.id, 'Checked In'), /before the check-in date/);
  assert.throws(() => service.setStatus(future.id, 'Checked Out'), /Only checked-in/);
  const tonight = service.createReservation(booking({ checkIn: D(0), checkOut: D(1) }));
  assert.equal(service.setStatus(tonight.id, 'Checked In').status, 'Checked In');
  assert.equal(service.setStatus(tonight.id, 'Checked Out').status, 'Checked Out');
  assert.throws(() => service.cancelReservation(tonight.id), (e) => e.status === 409);
});

test('guest lookup requires matching reference and email', () => {
  const { service } = setup();
  const r = service.createReservation(booking());
  assert.equal(service.findForGuest(r.reference.toLowerCase(), r.guest.email.toUpperCase()).id, r.id);
  assert.throws(() => service.findForGuest(r.reference, 'someone@else.com'), (e) => e.status === 404);
});

test('sample data is consistent with the inventory', () => {
  const { service, db } = setup({ seed: true });
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM reservations').get().n >= 10);
  for (let d = -7; d <= 14; d++) {
    for (const c of service.occupancyOn(D(d))) {
      assert.ok(c.occupied <= c.total, `${c.code} overbooked on ${D(d)}`);
    }
  }
  const dash = service.dashboard();
  assert.equal(dash.totalRooms, 20);
  assert.equal(dash.occupied + dash.available, 20);
});

test('notifications are recorded for confirmations, changes and cancellations', () => {
  const { service } = setup();
  const r = service.createReservation(booking());
  service.updateReservation(r.id, { checkOut: D(4) });
  service.cancelReservation(r.id);
  const types = service.notificationsFor(r.id).map((n) => n.type).reverse();
  assert.deepEqual(types, ['Booking Confirmation', 'Booking Modified', 'Booking Cancelled']);
});
