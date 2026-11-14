import Redis from 'ioredis';
import { logger } from './logger.js';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export function createRedisClient(role = 'cache') {
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: role === 'bullmq' ? null : 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    lazyConnect: false
  });

  client.on('error', (err) => {
    logger.warn({ role, error: err.message }, '[REDIS] Connection error');
  });

  client.on('connect', () => {
    logger.info({ role }, '[REDIS] Connected successfully');
  });

  return client;
}

export const redis = createRedisClient('main');

export async function closeRedis() {
  try {
    await redis.quit();
  } catch (_) {
    redis.disconnect();
  }
}

