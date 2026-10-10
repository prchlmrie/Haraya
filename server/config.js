import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const DB_FILE = process.env.DB_FILE ?? join(root, 'data', 'hotel.db');
export const PUBLIC_DIR = join(root, 'public');
export const THREE_DIR = join(root, 'node_modules', 'three');
export const FONTSOURCE_DIR = join(root, 'node_modules', '@fontsource');
export const PORT = Number(process.env.PORT ?? 3000);
