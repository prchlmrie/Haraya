import { openDatabase } from './server/db.js';
import { createReservationService } from './server/reservations.js';
import { createEventService } from './server/events.js';
import { seedIfEmpty, seedEventsIfEmpty } from './server/seed.js';
import { createApp } from './server/app.js';
import { DB_FILE, PORT, PUBLIC_DIR, THREE_DIR, FONTSOURCE_DIR } from './server/config.js';

const db = openDatabase(DB_FILE);
const service = createReservationService(db);
const events = createEventService(db);
if (seedIfEmpty(db, service)) console.log('Sample reservations created.');
if (seedEventsIfEmpty(db, events)) console.log('Sample events created.');

createApp(service, { publicDir: PUBLIC_DIR, threeDir: THREE_DIR, fontsDir: FONTSOURCE_DIR, events }).listen(PORT, () => {
  console.log(`Haraya Bay By Zaldy Land reservation simulation running:`);
  console.log(`  Guest site:      http://localhost:${PORT}/`);
  console.log(`  Events:          http://localhost:${PORT}/events.html`);
  console.log(`  Property map:    http://localhost:${PORT}/map.html`);
  console.log(`  3D room tour:    http://localhost:${PORT}/room.html`);
  console.log(`  Staff dashboard: http://localhost:${PORT}/staff.html`);
});
