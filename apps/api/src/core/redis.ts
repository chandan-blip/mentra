import { Redis } from 'ioredis';
import { env } from '../env.js';
import { logger } from '../logger.js';

/** Shared client for caching (flags, etc.). */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => logger.error({ err }, 'redis error'));

/**
 * BullMQ requires a dedicated connection with `maxRetriesPerRequest: null`.
 * Use a factory so queues and workers each get their own.
 */
export function createBullConnection(): Redis {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (err) => logger.error({ err }, 'redis (bull) error'));
  return connection;
}
