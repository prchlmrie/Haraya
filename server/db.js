import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildRoomList, TOTAL_ROOMS } from './inventory.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rooms (
    id        INTEGER PRIMARY KEY,
    number    TEXT NOT NULL UNIQUE,
    category  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS guests (
    id          INTEGER PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id                INTEGER PRIMARY KEY,
    reference         TEXT NOT NULL UNIQUE,
    guest_id          INTEGER NOT NULL REFERENCES guests(id),
    room_id           INTEGER NOT NULL REFERENCES rooms(id),
    category          TEXT NOT NULL,
    check_in          TEXT NOT NULL,
    check_out         TEXT NOT NULL,
    guests            INTEGER NOT NULL DEFAULT 1,
    status            TEXT NOT NULL,
    special_requests  TEXT NOT NULL DEFAULT '',
    nightly_rate      INTEGER NOT NULL,
    total_amount      INTEGER NOT NULL,
    source            TEXT NOT NULL DEFAULT 'Guest',
    created_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    CHECK (check_out > check_in)
  );

  CREATE INDEX IF NOT EXISTS idx_reservations_room_dates
    ON reservations (room_id, check_in, check_out);

  CREATE TABLE IF NOT EXISTS notifications (
    id              INTEGER PRIMARY KEY,
    reservation_id  INTEGER REFERENCES reservations(id),
    reference       TEXT NOT NULL,
    recipient       TEXT NOT NULL,
    type            TEXT NOT NULL,
    subject         TEXT NOT NULL,
    message         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id             INTEGER PRIMARY KEY,
    code           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    category       TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    includes       TEXT NOT NULL DEFAULT '',
    venue          TEXT NOT NULL,
    setup          TEXT NOT NULL DEFAULT '',
    date           TEXT NOT NULL,
    start_time     TEXT NOT NULL,
    end_time       TEXT NOT NULL,
    capacity       INTEGER NOT NULL,
    price          INTEGER NOT NULL DEFAULT 0,
    price_note     TEXT NOT NULL DEFAULT '',
    registration   TEXT NOT NULL DEFAULT 'open',
    status         TEXT NOT NULL DEFAULT 'Scheduled',
    visibility     TEXT NOT NULL DEFAULT 'public',
    organizer      TEXT NOT NULL DEFAULT '',
    contact_email  TEXT NOT NULL DEFAULT '',
    contact_phone  TEXT NOT NULL DEFAULT '',
    poster         TEXT NOT NULL DEFAULT 'gala',
    sample_note    TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    CHECK (end_time > start_time),
    CHECK (capacity > 0)
  );

  CREATE INDEX IF NOT EXISTS idx_events_venue_date ON events (venue, date);

  CREATE TABLE IF NOT EXISTS event_registrations (
    id            INTEGER PRIMARY KEY,
    reference     TEXT NOT NULL UNIQUE,
    event_id      INTEGER NOT NULL REFERENCES events(id),
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    email         TEXT NOT NULL COLLATE NOCASE,
    phone         TEXT NOT NULL,
    tickets       INTEGER NOT NULL DEFAULT 1,
    amount        INTEGER NOT NULL DEFAULT 0,
    notes         TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'Registered',
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    cancelled_at  TEXT,
    CHECK (tickets > 0)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );
`;

export function openDatabase(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const insertRoom = db.prepare('INSERT OR IGNORE INTO rooms (number, category) VALUES (?, ?)');
  for (const room of buildRoomList()) insertRoom.run(room.number, room.category);

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM rooms').get();
  if (count !== TOTAL_ROOMS) {
    throw new Error(`Room inventory mismatch: expected ${TOTAL_ROOMS} rooms, found ${count}.`);
  }
  return db;
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
