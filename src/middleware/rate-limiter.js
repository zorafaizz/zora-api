import { redis } from '../core/redis.js';
import { logger } from '../core/logger.js';
import { RateLimitError } from '../core/errors.js';

export function getClientIP(req) {
  // Hanya percayai X-Forwarded-For dari reverse proxy internal (Nginx 127.0.0.1)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const parts = forwarded.split(',').map(s => s.trim());
    return parts[0];
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Token Bucket Rate Limiter
 * Window 60 detik (1 menit)
 */
export function rateLimiterMiddleware(options = {}) {
  const windowSec = options.windowSec || 60;
  const defaultLimit = options.defaultLimit || 60; // 60 req/min default

  return async (req, res, next) => {
    // Abaikan rate limit untuk health check internal
    if (req.path === '/health' || req.path === '/api/v1/health') {
      return next();
    }

    const clientIp = getClientIP(req);
    const keyIdentifier = req.apiKey?.id ? `key:${req.apiKey.id}` : `ip:${clientIp}`;
    const rateLimitKey = `kg:ratelimit:${keyIdentifier}`;

    const limit = req.apiKey?.keyType === 'live'
      ? 120
      : (req.apiKey?.keyType === 'test' ? 60 : defaultLimit);

    try {
      const current = await redis.incr(rateLimitKey);
      if (current === 1) {
        await redis.expire(rateLimitKey, windowSec);
      }

      const ttl = await redis.ttl(rateLimitKey);
      const resetTime = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSec);

      const remaining = Math.max(0, limit - current);

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (current > limit) {
        throw new RateLimitError(`Rate limit terlampaui. Batas: ${limit} req/menit. Silakan tunggu reset.`);
      }

      next();
    } catch (err) {
      if (err instanceof RateLimitError) {
        return res.sendError(err, 429);
      }
      // Fail-open jika Redis mengalami kendala agar traffic pengguna tidak terputus
      logger.warn({ error: err.message }, '[RATELIMIT] Redis rate limiter error, allowing traffic');
      next();
    }
  };
}
