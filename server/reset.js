// Deletes the local database so the next `npm start` re-creates it with fresh sample data.
import { rmSync } from 'node:fs';
import { DB_FILE } from './config.js';

for (const suffix of ['', '-wal', '-shm', '-journal']) {
  rmSync(DB_FILE + suffix, { force: true });
}
console.log(`Removed ${DB_FILE}. Run "npm start" to recreate it with sample data.`);
