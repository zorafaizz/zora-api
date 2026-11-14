import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://kanjutgede_user:kanjutgede_secure_pass_2026_x9@127.0.0.1:5432/kanjutgede_db';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  logger.error({ error: err.message }, '[PG POOL] Unexpected error on idle client');
});

/**
 * Execute single parameterized query
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn({ text, duration, rows: res.rowCount }, '[PG POOL] Slow query detected');
    }
    return res;
  } catch (err) {
    logger.error({ text, error: err.message }, '[PG POOL] Query execution error');
    throw err;
  }
}

/**
 * Transaction Helper with Automatic BEGIN / COMMIT / ROLLBACK
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb() {
  await pool.end();
}
