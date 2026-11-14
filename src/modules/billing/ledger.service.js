import { query, withTransaction } from '../../core/db.js';
import { PaymentRequiredError, NotFoundError, AppError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';

export async function getWallet(accountId) {
  const res = await query('SELECT * FROM wallets WHERE account_id = $1', [accountId]);
  if (res.rowCount === 0) {
    throw new NotFoundError('Wallet tidak ditemukan untuk akun ini');
  }
  return res.rows[0];
}

/**
 * 1. RESERVE: Mengunci sejumlah kredit sebelum eksekusi dimulai
 */
export async function reserveCredits(accountId, amount, requestId, endpointId, ttlSeconds = 60) {
  const amountBig = BigInt(amount);
  if (amountBig <= 0n) return null;

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  return await withTransaction(async (client) => {
    // Kurangi balance_credits dan tambah reserved_credits secara atomik
    const updateRes = await client.query(
      `UPDATE wallets
       SET balance_credits = balance_credits - $1,
           reserved_credits = reserved_credits + $1,
           updated_at = NOW()
       WHERE account_id = $2 AND balance_credits >= $1
       RETURNING balance_credits, reserved_credits`,
      [amountBig.toString(), accountId]
    );

    if (updateRes.rowCount === 0) {
      throw new PaymentRequiredError(
        `Saldo kredit tidak mencukupi untuk reservasi ${amountBig.toString()} credits`
      );
    }

    // Catat reservasi
    const insertRes = await client.query(
      `INSERT INTO credit_reservations (account_id, request_id, endpoint_id, reserved_amount, status, expires_at)
       VALUES ($1, $2, $3, $4, 'RESERVED', $5)
       RETURNING *`,
      [accountId, requestId, endpointId, amountBig.toString(), expiresAt]
    );

    logger.info(
      { accountId, requestId, endpointId, amount: amountBig.toString() },
      '[LEDGER] Credits atomically reserved'
    );
    return insertRes.rows[0];
  });
}

/**
 * 2. CAPTURE: Memotong permanen kredit yang direservasi setelah eksekusi berhasil
 */
export async function captureReservation(requestId, actor = 'system', reason = 'API Endpoint execution successful') {
  return await withTransaction(async (client) => {
    // Ambil reservasi dengan status RESERVED dan kunci baris
    const res = await client.query(
      `SELECT * FROM credit_reservations 
       WHERE request_id = $1 AND status = 'RESERVED' 
       FOR UPDATE`,
      [requestId]
    );

    if (res.rowCount === 0) {
      logger.warn({ requestId }, '[LEDGER] Reservation not found or already settled');
      return null;
    }

    const reservation = res.rows[0];
    const amountBig = BigInt(reservation.reserved_amount);

    // Update status reservasi ke CAPTURED
    await client.query(
      "UPDATE credit_reservations SET status = 'CAPTURED' WHERE id = $1",
      [reservation.id]
    );

    // Ambil wallet dan kurangi reserved_credits
    const walletRes = await client.query(
      `UPDATE wallets
       SET reserved_credits = reserved_credits - $1,
           updated_at = NOW()
       WHERE account_id = $2
       RETURNING id, balance_credits`,
      [amountBig.toString(), reservation.account_id]
    );

    const wallet = walletRes.rows[0];

    // Catat mutasi pada append-only credit_ledger
    await client.query(
      `INSERT INTO credit_ledger (wallet_id, account_id, amount, balance_after, operation_type, reference_id, actor, reason)
       VALUES ($1, $2, $3, $4, 'usage_deduction', $5, $6, $7)`,
      [
        wallet.id,
        reservation.account_id,
        (-amountBig).toString(),
        wallet.balance_credits,
        requestId,
        actor,
        reason
      ]
    );

    logger.info(
      { accountId: reservation.account_id, requestId, capturedAmount: amountBig.toString() },
      '[LEDGER] Credits captured & ledger written'
    );
    return reservation;
  });
}

/**
 * 3. RELEASE: Mengembalikan kredit yang direservasi jika eksekusi gagal
 */
export async function releaseReservation(requestId, reason = 'Execution failed or cancelled') {
  return await withTransaction(async (client) => {
    const res = await client.query(
      `SELECT * FROM credit_reservations 
       WHERE request_id = $1 AND status = 'RESERVED' 
       FOR UPDATE`,
      [requestId]
    );

    if (res.rowCount === 0) {
      return null;
    }

    const reservation = res.rows[0];
    const amountBig = BigInt(reservation.reserved_amount);

    // Update status reservasi ke RELEASED
    await client.query(
      "UPDATE credit_reservations SET status = 'RELEASED' WHERE id = $1",
      [reservation.id]
    );

    // Kembalikan reserved_credits ke balance_credits
    await client.query(
      `UPDATE wallets
       SET balance_credits = balance_credits + $1,
           reserved_credits = reserved_credits - $1,
           updated_at = NOW()
       WHERE account_id = $2`,
      [amountBig.toString(), reservation.account_id]
    );

    logger.info(
      { accountId: reservation.account_id, requestId, amount: amountBig.toString(), reason },
      '[LEDGER] Reservation released back to available balance'
    );
    return reservation;
  });
}

/**
 * Tambah kredit ke wallet (Topup / Refund / Admin adjustment)
 */
export async function grantCredits(accountId, amount, operationType, referenceId, actor, reason) {
  const amountBig = BigInt(amount);
  if (amountBig <= 0n) throw new AppError('Jumlah kredit harus bernilai positif', 400);

  return await withTransaction(async (client) => {
    const updateWallet = await client.query(
      `UPDATE wallets
       SET balance_credits = balance_credits + $1,
           updated_at = NOW()
       WHERE account_id = $2
       RETURNING id, balance_credits`,
      [amountBig.toString(), accountId]
    );

    if (updateWallet.rowCount === 0) {
      throw new NotFoundError('Wallet tidak ditemukan');
    }

    const wallet = updateWallet.rows[0];

    // Catat mutasi pada append-only credit_ledger
    await client.query(
      `INSERT INTO credit_ledger (wallet_id, account_id, amount, balance_after, operation_type, reference_id, actor, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        wallet.id,
        accountId,
        amountBig.toString(),
        wallet.balance_credits,
        operationType,
        referenceId,
        actor,
        reason
      ]
    );

    logger.info(
      { accountId, amount: amountBig.toString(), operationType, referenceId },
      '[LEDGER] Credits granted successfully'
    );
    return wallet;
  });
}

export async function getLedgerHistory(accountId, limit = 50, offset = 0) {
  const res = await query(
    `SELECT id, amount, balance_after, operation_type, reference_id, actor, reason, created_at
     FROM credit_ledger
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [accountId, limit, offset]
  );
  return res.rows;
}
