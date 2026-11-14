import crypto from 'node:crypto';
import { query, withTransaction } from '../../core/db.js';
import { getPaymentProvider } from './payment-provider.interface.js';
import { grantCredits } from './ledger.service.js';
import { AppError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';

const MIN_TOPUP_IDR = 10000; // Minimal topup Rp 10.000
const IDR_PER_CREDIT = 10;   // 1 Credit = Rp 10,-

export async function createTopupInvoice(accountId, amountIdr) {
  const amount = parseInt(amountIdr, 10);
  if (isNaN(amount) || amount < MIN_TOPUP_IDR) {
    throw new AppError(`Nominal topup minimal adalah Rp ${MIN_TOPUP_IDR.toLocaleString('id-ID')}`, 400);
  }

  const creditAmount = Math.floor(amount / IDR_PER_CREDIT);
  const invoiceNumber = `INV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const provider = getPaymentProvider();

  return await withTransaction(async (client) => {
    // 1. Simpan invoice dengan status PENDING
    const insertRes = await client.query(
      `INSERT INTO invoices (account_id, invoice_number, amount_idr, credit_amount, status, provider)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)
       RETURNING *`,
      [accountId, invoiceNumber, amount, creditAmount, provider.constructor.name]
    );

    const invoice = insertRes.rows[0];

    // 2. Hubungi payment provider (Jika disabled -> throw PAYMENT_PROVIDER_NOT_CONFIGURED)
    const intent = await provider.createIntent(invoice);

    if (intent.providerTxId) {
      await client.query(
        'UPDATE invoices SET provider_tx_id = $1 WHERE id = $2',
        [intent.providerTxId, invoice.id]
      );
    }

    logger.info({ invoiceId: invoice.id, invoiceNumber, amount, creditAmount }, '[BILLING] Invoice created');

    return {
      invoiceNumber: invoice.invoice_number,
      amountIdr: invoice.amount_idr,
      creditAmount: invoice.credit_amount,
      status: invoice.status,
      checkoutUrl: intent.checkoutUrl,
      qrisString: intent.qrisString,
      expiresAt: intent.expiresAt
    };
  });
}

/**
 * Handle Webhook Callback dari Payment Gateway (Idempotent)
 */
export async function handlePaymentWebhook(headers, body) {
  const provider = getPaymentProvider();

  // 1. Verifikasi tanda tangan kriptografi (HMAC)
  const verified = await provider.verifyWebhook(headers, body);

  const { invoiceNumber, status } = verified;

  return await withTransaction(async (client) => {
    // 2. Kunci baris invoice dengan FOR UPDATE untuk mencegah race condition
    const invRes = await client.query(
      'SELECT * FROM invoices WHERE invoice_number = $1 FOR UPDATE',
      [invoiceNumber]
    );

    if (invRes.rowCount === 0) {
      throw new NotFoundError(`Invoice '${invoiceNumber}' tidak ditemukan`);
    }

    const invoice = invRes.rows[0];

    // 3. Idempotency Check: Jika invoice sudah PAID, kembalikan respon sukses tanpa menduplikasi kredit
    if (invoice.status === 'PAID') {
      logger.info({ invoiceNumber }, '[BILLING] Webhook received for already PAID invoice. Idempotent skip');
      return { status: 'already_processed', invoiceNumber };
    }

    if (status === 'PAID') {
      // 4. Update status invoice ke PAID
      await client.query(
        "UPDATE invoices SET status = 'PAID', paid_at = NOW() WHERE id = $1",
        [invoice.id]
      );

      // 5. Tambahkan kredit secara atomik ke wallet dan credit_ledger
      await grantCredits(
        invoice.account_id,
        invoice.credit_amount,
        'topup',
        invoice.id,
        'payment_webhook',
        `Topup saldo ${invoice.credit_amount} credits via ${invoice.provider}`
      );

      logger.info(
        { invoiceNumber, accountId: invoice.account_id, credits: invoice.credit_amount },
        '[BILLING] Invoice fulfilled and credits granted'
      );

      return { status: 'success', invoiceNumber, creditsGranted: invoice.credit_amount };
    }

    return { status: 'unhandled_status', currentStatus: status };
  });
}
