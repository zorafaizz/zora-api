import { query, withTransaction } from '../../core/db.js';
import { QuotaExceededError, ForbiddenError, PaymentRequiredError } from '../../core/errors.js';
import { evaluateAccountInactivity, touchLiveActivity } from './account.service.js';
import { logger } from '../../core/logger.js';

export function getJakartaDateString() {
  // Mengembalikan tanggal YYYY-MM-DD dalam zona waktu Asia/Jakarta (WIB)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

/**
 * Konsumsi kuota untuk pemanggilan endpoint
 * @param {Object} account Akun pengguna
 * @param {Object} apiKey API Key yang digunakan
 * @param {Object} endpointDef Definisi endpoint dari registry
 * @returns {Object} { quotaType: 'none' | 'test' | 'free' | 'paid', remaining }
 */
export async function consumeQuotaForRequest(account, apiKey, endpointDef) {
  const keyType = apiKey.keyType || apiKey.key_type || 'live';

  // 1. Endpoint tanpa kuota (misal /health)
  if (endpointDef.billing_policy?.type === 'no_quota') {
    return { quotaType: 'none', remaining: null };
  }

  // 2. Mode TEST KEY (Lifetime 50 requests)
  if (keyType === 'test') {
    const res = await query(
      `UPDATE accounts 
       SET test_quota_remaining = test_quota_remaining - 1 
       WHERE id = $1 AND test_quota_remaining > 0 
       RETURNING test_quota_remaining`,
      [account.id]
    );

    if (res.rowCount === 0) {
      throw new QuotaExceededError(
        'Batas alokasi kuota TEST seumur hidup (50 request) telah habis untuk akun ini.'
      );
    }

    const remaining = res.rows[0].test_quota_remaining;
    return { quotaType: 'test', remaining };
  }

  // 3. Mode LIVE KEY (20 Free / Day di Asia/Jakarta)
  // Periksa apakah akun terkena inaktivitas 120 jam
  const freshAccount = await evaluateAccountInactivity(account);
  if (freshAccount.is_frozen) {
    throw new ForbiddenError(
      'Benefit 20 request gratis harian dibekukan karena tidak aktif selama 5 hari (120 jam). ' +
      'Silakan lakukan reaktivasi melalui dashboard (POST /api/v1/account/reactivate) atau gunakan saldo kredit berbayar.'
    );
  }

  // Cek apakah endpoint ini memenuhi syarat kuota gratis
  const isFreeEligible = endpointDef.billing_policy?.type === 'free_eligible';

  if (isFreeEligible) {
    const today = getJakartaDateString();

    // Buat atau update kuota harian secara atomik
    const quotaRes = await withTransaction(async (client) => {
      // Pastikan row hari ini sudah ada
      await client.query(
        `INSERT INTO daily_quotas (account_id, quota_date, used_count, max_count)
         VALUES ($1, $2, 0, 20)
         ON CONFLICT (account_id, quota_date) DO NOTHING`,
        [account.id, today]
      );

      // Coba potong kuota harian
      const updateRes = await client.query(
        `UPDATE daily_quotas
         SET used_count = used_count + 1
         WHERE account_id = $1 AND quota_date = $2 AND used_count < max_count
         RETURNING used_count, max_count`,
        [account.id, today]
      );

      if (updateRes.rowCount > 0) {
        const row = updateRes.rows[0];
        return { success: true, remaining: row.max_count - row.used_count };
      }

      return { success: false, remaining: 0 };
    });

    if (quotaRes.success) {
      // Perbarui waktu aktivitas live terakhir
      touchLiveActivity(account.id).catch(() => {});
      return { quotaType: 'free', remaining: quotaRes.remaining };
    }
  }

  // Jika tidak eligible kuota gratis atau kuota gratis harian sudah habis (20/20),
  // Cek apakah ada saldo kredit berbayar di wallet
  const requiredCredits = BigInt(endpointDef.billing_policy?.paid_credits || 1);
  const walletRes = await query('SELECT * FROM wallets WHERE account_id = $1', [account.id]);
  const wallet = walletRes.rows[0];

  if (!wallet || BigInt(wallet.balance_credits) < requiredCredits) {
    if (isFreeEligible) {
      throw new QuotaExceededError(
        'Kuota harian gratis (20 request/hari) Anda untuk hari ini telah habis. ' +
        'Silakan tunggu reset pukul 00:00 WIB atau tambahkan saldo kredit berbayar.'
      );
    } else {
      throw new PaymentRequiredError(
        `Endpoint '${endpointDef.id}' memerlukan saldo kredit berbayar (${requiredCredits} credits). Saldo Anda tidak mencukupi.`
      );
    }
  }

  // Akun memiliki saldo kredit berbayar -> reservasi kredit
  touchLiveActivity(account.id).catch(() => {});
  return { quotaType: 'paid', requiredCredits, wallet };
}
