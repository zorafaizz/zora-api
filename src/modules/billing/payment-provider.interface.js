import crypto from 'node:crypto';
import { AppError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';

export class PaymentProvider {
  async createIntent(invoice) {
    throw new Error('Not implemented');
  }

  async verifyWebhook(headers, body) {
    throw new Error('Not implemented');
  }
}

/**
 * Production Disabled Provider
 * Menolak pemanggilan real payment dan mengembalikan PAYMENT_PROVIDER_NOT_CONFIGURED
 */
export class DisabledPaymentProvider extends PaymentProvider {
  async createIntent(invoice) {
    throw new AppError(
      'PAYMENT_PROVIDER_NOT_CONFIGURED: Payment Gateway riil belum dikonfigurasi. Sistem billing saat ini berjalan dalam mode testing sandbox.',
      503,
      'PAYMENT_PROVIDER_NOT_CONFIGURED'
    );
  }

  async verifyWebhook(headers, body) {
    throw new AppError('Payment webhook is disabled in production without active gateway', 503);
  }
}

/**
 * Deterministic Mock Provider (Eksklusif untuk Sandbox / Testing)
 */
export class MockPaymentProvider extends PaymentProvider {
  constructor(secret = null) {
    super();
    this.secret = secret || process.env.MOCK_WEBHOOK_SECRET || 'sandbox_mock_webhook_secret_key_123';
  }

  async createIntent(invoice) {
    const mockTxId = `mock_tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const mockQrisString = `00020101021226600016ID.CO.QRIS.WWW01189360099900000000010215${invoice.invoice_number}520458125303360540${invoice.amount_idr}5802ID5910KANJUTGEDE6007JAKARTA62070703A016304`;

    logger.info({ invoiceId: invoice.id, mockTxId }, '[MOCK-PAYMENT] Created mock payment intent');

    return {
      success: true,
      provider: 'mock',
      providerTxId: mockTxId,
      checkoutUrl: `https://api.itsfaiz.my.id/sandbox/pay/${invoice.invoice_number}`,
      qrisString: mockQrisString,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };
  }

  async verifyWebhook(headers, body) {
    const signature = headers['x-mock-signature'] || headers['x-signature'];
    if (!signature) {
      throw new AppError('Mock signature missing', 400, 'INVALID_SIGNATURE');
    }

    const payloadString = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payloadString)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new AppError('Mock signature mismatch', 401, 'INVALID_SIGNATURE');
    }

    return {
      isValid: true,
      invoiceNumber: body.invoice_number,
      amountIdr: body.amount_idr,
      providerTxId: body.provider_tx_id,
      status: body.status || 'PAID'
    };
  }

  generateTestSignature(payload) {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.secret)
      .update(payloadString)
      .digest('hex');
  }
}

export function getPaymentProvider() {
  const env = process.env.NODE_ENV || 'development';
  const forceMock = process.env.ENABLE_MOCK_PAYMENT === 'true' || env === 'test';

  if (forceMock) {
    return new MockPaymentProvider();
  }

  return new DisabledPaymentProvider();
}
