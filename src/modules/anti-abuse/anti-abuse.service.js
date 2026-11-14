import { redis } from '../../core/redis.js';
import { logger } from '../../core/logger.js';

export class AntiAbuseEngine {
  constructor(options = {}) {
    this.shadowMode = options.shadowMode !== false; // Default: Shadow Mode aktif
    this.riskThreshold = options.riskThreshold || 75;
  }

  /**
   * Evaluasi risiko permintaan berdasarkan korelasi multi-sinyal
   */
  async evaluateRisk({ accountId, apiKeyId, clientIp, endpointId, quotaExhausted = false }) {
    let score = 0;
    const reasons = [];

    // 1. Sinyal: Rapid Key Switching setelah kuota habis
    if (quotaExhausted) {
      try {
        const exhaustionKey = `kg:abuse:exhaust:${clientIp}`;
        await redis.set(exhaustionKey, accountId, 'EX', 10); // Simpan 10 detik
      } catch (_) {}
    } else {
      try {
        const lastExhaustedAccount = await redis.get(`kg:abuse:exhaust:${clientIp}`);
        if (lastExhaustedAccount && lastExhaustedAccount !== accountId) {
          score += 30;
          reasons.push('RAPID_KEY_SWITCH_POST_EXHAUSTION');
        }
      } catch (_) {}
    }

    // 2. Sinyal: IP Bersama (Bobot Lemah, maks +5)
    // Satu IP sharing panel bot (misal node Pterodactyl) tidak boleh dianggap kejahatan
    if (clientIp) {
      score += 5;
      reasons.push('SHARED_NETWORK_WEAK_SIGNAL');
    }

    const assessment = {
      accountId,
      apiKeyId,
      clientIp,
      score,
      reasons,
      action: score >= this.riskThreshold ? 'FLAG_REVIEW' : 'PASS',
      shadowMode: this.shadowMode
    };

    if (score >= this.riskThreshold) {
      logger.warn(assessment, '[ANTI-ABUSE] Suspicious multi-signal correlation detected (Shadow Mode)');
    }

    return assessment;
  }
}

export const antiAbuseEngine = new AntiAbuseEngine();
