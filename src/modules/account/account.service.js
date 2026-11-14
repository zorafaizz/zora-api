import { query, withTransaction } from '../../core/db.js';
import { NotFoundError, ForbiddenError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';

const INACTIVITY_FREEZE_MS = 120 * 60 * 60 * 1000; // 120 jam (5 hari)

export async function createOrFindAccount(email, role = 'user') {
  const normalizedEmail = email.trim().toLowerCase();

  return await withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM accounts WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      return existing.rows[0];
    }

    // Buat akun baru dengan default 50 test quota dan wallet baru
    const insertAcc = await client.query(
      `INSERT INTO accounts (email, role, last_live_activity_at, test_quota_remaining)
       VALUES ($1, $2, NOW(), 50)
       RETURNING *`,
      [normalizedEmail, role]
    );
    const account = insertAcc.rows[0];

    // Buat wallet kredit
    await client.query(
      `INSERT INTO wallets (account_id, balance_credits, reserved_credits)
       VALUES ($1, 0, 0)`,
      [account.id]
    );

    logger.info({ accountId: account.id, email: normalizedEmail }, '[ACCOUNT] New account and wallet created');
    return account;
  });
}

export async function getAccountById(accountId) {
  const res = await query('SELECT * FROM accounts WHERE id = $1', [accountId]);
  if (res.rowCount === 0) {
    throw new NotFoundError('Akun tidak ditemukan');
  }
  return res.rows[0];
}

/**
 * Cek dan update status inaktivitas (Lazy evaluation)
 * Jika tidak ada request live sukses selama 120 jam, bekukan benefit gratis
 */
export async function evaluateAccountInactivity(account) {
  if (account.is_frozen) {
    return account;
  }

  const lastActivity = new Date(account.last_live_activity_at).getTime();
  const now = Date.now();

  if (now - lastActivity > INACTIVITY_FREEZE_MS) {
    logger.warn({ accountId: account.id }, '[ACCOUNT] 120h inactivity reached. Freezing daily free benefit');
    const updated = await query(
      'UPDATE accounts SET is_frozen = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [account.id]
    );
    return updated.rows[0];
  }

  return account;
}

/**
 * Reaktivasi eksplisit benefit gratis dari dashboard
 */
export async function reactivateFreeBenefit(accountId) {
  const account = await getAccountById(accountId);

  const res = await query(
    `UPDATE accounts 
     SET is_frozen = FALSE, last_live_activity_at = NOW(), updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [accountId]
  );

  logger.info({ accountId }, '[ACCOUNT] Free daily benefit explicitly reactivated');
  return res.rows[0];
}

/**
 * Update timestamp aktivitas live terakhir yang sah
 */
export async function touchLiveActivity(accountId) {
  await query(
    'UPDATE accounts SET last_live_activity_at = NOW(), is_frozen = FALSE, updated_at = NOW() WHERE id = $1',
    [accountId]
  );
}
