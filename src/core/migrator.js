import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, withTransaction } from './db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

export async function runMigrations(direction = 'up') {
  // Buat tabel schema_migrations jika belum ada
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const files = await fs.readdir(MIGRATIONS_DIR);

  if (direction === 'up') {
    const upFiles = files.filter(f => f.endsWith('.sql') && !f.endsWith('_down.sql')).sort();
    for (const file of upFiles) {
      const version = file.replace('.sql', '');
      const existing = await query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
      if (existing.rowCount === 0) {
        logger.info({ version, file }, '[MIGRATOR] Applying migration UP');
        const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
        await withTransaction(async (client) => {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        });
        logger.info({ version }, '[MIGRATOR] Migration UP successfully applied');
      }
    }
  } else if (direction === 'down') {
    const downFiles = files.filter(f => f.endsWith('_down.sql')).sort().reverse();
    for (const file of downFiles) {
      const version = file.replace('_down.sql', '');
      const existing = await query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
      if (existing.rowCount > 0) {
        logger.info({ version, file }, '[MIGRATOR] Applying migration DOWN');
        const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
        await withTransaction(async (client) => {
          await client.query(sql);
          await client.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
        });
        logger.info({ version }, '[MIGRATOR] Migration DOWN successfully reverted');
      }
    }
  }
}
