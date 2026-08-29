import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';

/**
 * Get ioredis configuration options compatible with Upstash Redis and BullMQ
 */
export const getRedisOptions = (): RedisOptions => {
  const options: RedisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    keepAlive: 10000,
    connectTimeout: 20000,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      // Exponential backoff retry strategy capping at 5 seconds delay
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  };

  // Upstash Redis SSL configuration for rediss:// URLs
  if (config.redisUrl.startsWith('rediss://')) {
    options.tls = {
      rejectUnauthorized: false,
    };
  }

  return options;
};

/**
 * Factory to create a new Redis connection instance.
 * Attaches a safe error listener to prevent unhandled ETIMEDOUT events.
 */
export const createRedisConnection = (): Redis => {
  const redis = new Redis(config.redisUrl, getRedisOptions());
  
  redis.on('error', (err: any) => {
    // Log connection events without emitting unhandled process crashes
    console.warn(`[Redis] Connection event (${err.code || 'ERR'}):`, err.message);
  });

  return redis;
};

// Shared Redis client for non-blocking utilities like rate limiting or manual scripting
export const redisConnection = createRedisConnection();

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pingRes = await redisConnection.ping();
    return pingRes === 'PONG';
  } catch (err) {
    return false;
  }
}
