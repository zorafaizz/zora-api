import { LRUCache } from 'lru-cache';
import { redis } from './redis.js';
import { logger } from './logger.js';

// L1 In-Memory Cache (Bounded to 2000 entries)
const l1Cache = new LRUCache({
  max: 2000,
  ttl: 1000 * 60 * 5, // Default 5 menit
  updateAgeOnGet: false
});

// Singleflight map untuk mencegah cache stampede
const pendingPromises = new Map();

/**
 * Cache Wrapper dengan Stampede Protection
 * @param {string} key Kunci cache unik
 * @param {number} ttlSeconds Masa berlaku dalam detik
 * @param {Function} fetcherFn Fungsi yang dieksekusi jika cache miss
 */
export async function getOrSetCache(key, ttlSeconds, fetcherFn) {
  if (!key || ttlSeconds <= 0) {
    return await fetcherFn();
  }

  const normalizedKey = `kg:cache:${key}`;

  // 1. Cek L1 Cache (Memory)
  const l1Value = l1Cache.get(normalizedKey);
  if (l1Value !== undefined) {
    return l1Value;
  }

  // 2. Singleflight: Jika sudah ada eksekusi aktif untuk kunci ini, tunggu promise yang sama
  if (pendingPromises.has(normalizedKey)) {
    return await pendingPromises.get(normalizedKey);
  }

  const executionPromise = (async () => {
    try {
      // 3. Cek L2 Cache (Redis)
      try {
        const cachedRaw = await redis.get(normalizedKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          l1Cache.set(normalizedKey, parsed, { ttl: Math.min(ttlSeconds * 1000, 60000) });
          return parsed;
        }
      } catch (redisErr) {
        logger.warn({ key: normalizedKey, error: redisErr.message }, '[CACHE] Redis get failed, continuing without cache');
      }

      // 4. Cache Miss -> Eksekusi fungsi asli
      const result = await fetcherFn();

      if (result !== undefined && result !== null) {
        // Terapkan TTL Jitter (±10%) untuk menghindari expirasi serentak
        const jitter = Math.floor(ttlSeconds * 0.1 * (Math.random() * 2 - 1));
        const finalTtl = Math.max(1, ttlSeconds + jitter);

        // Simpan ke L1
        l1Cache.set(normalizedKey, result, { ttl: Math.min(finalTtl * 1000, 60000) });

        // Simpan ke L2 Redis
        try {
          await redis.set(normalizedKey, JSON.stringify(result), 'EX', finalTtl);
        } catch (redisSetErr) {
          logger.warn({ key: normalizedKey, error: redisSetErr.message }, '[CACHE] Redis set failed');
        }
      }

      return result;
    } finally {
      pendingPromises.delete(normalizedKey);
    }
  })();

  pendingPromises.set(normalizedKey, executionPromise);
  return await executionPromise;
}

export async function invalidateCache(key) {
  const normalizedKey = `kg:cache:${key}`;
  l1Cache.delete(normalizedKey);
  try {
    await redis.del(normalizedKey);
  } catch (err) {
    logger.warn({ key: normalizedKey, error: err.message }, '[CACHE] Redis del failed');
  }
}
