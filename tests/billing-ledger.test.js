import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrFindAccount } from '../src/modules/account/account.service.js';
import { reserveCredits, captureReservation, releaseReservation, grantCredits, getWallet, getLedgerHistory } from '../src/modules/billing/ledger.service.js';
import { createTopupInvoice, handlePaymentWebhook } from '../src/modules/billing/billing.service.js';
import { MockPaymentProvider, DisabledPaymentProvider } from '../src/modules/billing/payment-provider.interface.js';
import { closeDb, query } from '../src/core/db.js';
import { closeRedis } from '../src/core/redis.js';

test.after(async () => {
  await closeRedis();
  await closeDb();
});

test('Double-Entry Credit Ledger & Reservation Tests', async (t) => {
  const account = await createOrFindAccount(`ledger-user-${Date.now()}@itsfaiz.my.id`);

  await t.test('grantCredits deposits credits and writes to ledger', async () => {
    const wallet = await grantCredits(account.id, 100, 'topup', 'MANUAL_REF_1', 'admin', 'Initial grant');
    assert.equal(wallet.balance_credits, '100');

    const history = await getLedgerHistory(account.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].operation_type, 'topup');
    assert.equal(history[0].amount, '100');
    assert.equal(history[0].balance_after, '100');
  });

  await t.test('reserve -> capture workflow captures exact credits', async () => {
    const reqId = `req_${Date.now()}_1`;
    const reservation = await reserveCredits(account.id, 30, reqId, 'media.uhd');
    assert.equal(reservation.reserved_amount, '30');

    // Balance harus berkurang 30, reserved bertambah 30
    const w1 = await getWallet(account.id);
    assert.equal(w1.balance_credits, '70');
    assert.equal(w1.reserved_credits, '30');

    // Capture
    await captureReservation(reqId, 'system', 'Execution finished');

    const w2 = await getWallet(account.id);
    assert.equal(w2.balance_credits, '70');
    assert.equal(w2.reserved_credits, '0');

    const history = await getLedgerHistory(account.id);
    assert.equal(history[0].operation_type, 'usage_deduction');
    assert.equal(history[0].amount, '-30');
    assert.equal(history[0].balance_after, '70');
  });

  await t.test('reserve -> release workflow returns credits on failure', async () => {
    const reqId = `req_${Date.now()}_2`;
    await reserveCredits(account.id, 20, reqId, 'solve.waf');

    const w1 = await getWallet(account.id);
    assert.equal(w1.balance_credits, '50');
    assert.equal(w1.reserved_credits, '20');

    // Eksekusi gagal -> release
    await releaseReservation(reqId, 'Upstream provider timed out');

    const w2 = await getWallet(account.id);
    assert.equal(w2.balance_credits, '70', 'Credits must be fully restored');
    assert.equal(w2.reserved_credits, '0');
  });

  await t.test('concurrent reservations cannot overdraw wallet balance', async () => {
    // Sisa saldo sekarang 70 credits.
    // Lakukan 10 reservasi simultan sebesar 20 credits (Total butuh 200 credits, saldo hanya ada 70)
    // Tepat 3 harus berhasil (3 x 20 = 60), 7 harus gagal dengan PaymentRequiredError
    const attempts = [];
    for (let i = 0; i < 10; i++) {
      const rId = `concurrent_req_${Date.now()}_${i}`;
      attempts.push(
        reserveCredits(account.id, 20, rId, 'media.hd')
          .then(() => ({ success: true }))
          .catch((err) => ({ success: false, error: err.code }))
      );
    }

    const results = await Promise.all(attempts);
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    assert.equal(successes.length, 3, 'Exactly 3 reservations should succeed');
    assert.equal(failures.length, 7, '7 reservations should fail');

    const w = await getWallet(account.id);
    assert.equal(w.balance_credits, '10', 'Remaining balance should be 10');
    assert.equal(w.reserved_credits, '60', 'Reserved balance should be 60');
  });
});

test('Payment Gateway Sandbox & Top-up Invariants Tests', async (t) => {
  const account = await createOrFindAccount(`pay-user-${Date.now()}@itsfaiz.my.id`);
  process.env.MOCK_WEBHOOK_SECRET = 'sandbox_mock_webhook_secret_key_123';
  const mockProvider = new MockPaymentProvider(process.env.MOCK_WEBHOOK_SECRET);

  await t.test('DisabledPaymentProvider throws PAYMENT_PROVIDER_NOT_CONFIGURED', async () => {
    const disabled = new DisabledPaymentProvider();
    await assert.rejects(async () => {
      await disabled.createIntent({ id: 'dummy', amount_idr: 50000 });
    }, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  });

  await t.test('MockPaymentProvider creates intent and verifies HMAC webhook idempotently', async () => {
    // 1. Buat invoice topup Rp 20.000 (harus dapat 2.000 credits)
    process.env.ENABLE_MOCK_PAYMENT = 'true';
    const invoice = await createTopupInvoice(account.id, 20000);
    assert.ok(invoice.invoiceNumber.startsWith('INV-'));
    assert.equal(Number(invoice.creditAmount), 2000);
    assert.ok(invoice.qrisString, 'Must contain simulated QRIS string');

    // 2. Simulasi Webhook dari Gateway
    const webhookPayload = {
      invoice_number: invoice.invoiceNumber,
      amount_idr: 20000,
      provider_tx_id: 'mock_tx_real_123',
      status: 'PAID'
    };

    const signature = mockProvider.generateTestSignature(webhookPayload);
    const headers = { 'x-mock-signature': signature };

    // Set mock provider secret
    process.env.MOCK_WEBHOOK_SECRET = 'sandbox_mock_webhook_secret_key_123';

    // Eksekusi webhook
    const hookResult1 = await handlePaymentWebhook(headers, webhookPayload);
    assert.equal(hookResult1.status, 'success');
    assert.equal(Number(hookResult1.creditsGranted), 2000);

    const w1 = await getWallet(account.id);
    assert.equal(w1.balance_credits, '2000', 'Balance must increase by 2000');

    // 3. Uji Idempotency: Kirim webhook yang sama kedua kalinya
    const hookResult2 = await handlePaymentWebhook(headers, webhookPayload);
    assert.equal(hookResult2.status, 'already_processed');

    const w2 = await getWallet(account.id);
    assert.equal(w2.balance_credits, '2000', 'Balance must NOT be duplicated!');
  });
});
