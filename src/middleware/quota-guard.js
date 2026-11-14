import { findEndpointByPath } from '../registry/endpoints.js';
import { consumeQuotaForRequest } from '../modules/account/quota.service.js';
import { reserveCredits, captureReservation, releaseReservation, getWallet } from '../modules/billing/ledger.service.js';
import { query } from '../core/db.js';
import { logger } from '../core/logger.js';
import { getClientIP } from './rate-limiter.js';

export function quotaGuardMiddleware() {
  return async (req, res, next) => {
    // Abaikan jika tidak ada route endpoint yang terdaftar
    const endpoint = findEndpointByPath(req.path);
    if (!endpoint || endpoint.billing_policy?.type === 'no_quota') {
      return next();
    }

    if (!req.account || !req.apiKey) {
      // Jika route mewajibkan kuota tetapi lolos auth tanpa akun, teruskan
      return next();
    }

    try {
      // 1. Konsumsi kuota atau tentukan apakah perlu memotong kredit berbayar
      const quotaResult = await consumeQuotaForRequest(req.account, req.apiKey, endpoint);

      let reservation = null;
      if (quotaResult.quotaType === 'paid') {
        // Reservasi kredit atomik sebelum eksekusi dimulai
        reservation = await reserveCredits(
          req.account.id,
          quotaResult.requiredCredits,
          req.id,
          endpoint.id,
          60 // 60 detik reservation lease
        );
      }

      req._billing = {
        quotaType: quotaResult.quotaType,
        remaining: quotaResult.remaining,
        reservation,
        endpointId: endpoint.id,
        credits: quotaResult.requiredCredits || 0
      };

      // Set response headers awal
      if (quotaResult.quotaType === 'free') {
        res.setHeader('X-Quota-Daily-Remaining', quotaResult.remaining);
      } else if (quotaResult.quotaType === 'test') {
        res.setHeader('X-Quota-Test-Remaining', quotaResult.remaining);
      }

      // 2. Hook lifecycle response finish untuk Capture atau Release
      let settled = false;
      const settleBilling = async () => {
        if (settled) return;
        settled = true;

        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        const latencyMs = Date.now() - (req._startTime || Date.now());
        const clientIp = getClientIP(req);

        if (reservation) {
          if (isSuccess) {
            await captureReservation(req.id, 'system', `Endpoint execution: ${endpoint.id}`).catch(() => {});
          } else {
            await releaseReservation(req.id, `Execution failed with HTTP ${res.statusCode}`).catch(() => {});
          }
        }

        // Ambil sisa saldo wallet terbaru untuk header X-Credit-Remaining
        try {
          const freshWallet = await getWallet(req.account.id);
          res.setHeader('X-Credit-Remaining', freshWallet.balance_credits.toString());
        } catch (_) {}

        // Catat Audit Log
        const validApiKeyId = (req.apiKey?.id && typeof req.apiKey.id === 'string' && req.apiKey.id.length === 36)
          ? req.apiKey.id
          : null;

        const creditsCharged = (isSuccess && quotaResult.quotaType === 'paid')
          ? (quotaResult.requiredCredits || 0).toString()
          : '0';

        query(
          `INSERT INTO audit_logs (account_id, api_key_id, endpoint_id, method, status_code, latency_ms, credits_charged, quota_type, client_ip, request_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            req.account.id,
            validApiKeyId,
            endpoint.id,
            req.method,
            res.statusCode,
            latencyMs,
            creditsCharged,
            quotaResult.quotaType,
            clientIp,
            req.id
          ]
        ).catch((err) => {
          logger.warn({ error: err.message }, '[AUDIT] Failed to write audit log');
        });
      };

      res.on('finish', settleBilling);
      res.on('close', settleBilling);

      next();
    } catch (err) {
      next(err);
    }
  };
}
