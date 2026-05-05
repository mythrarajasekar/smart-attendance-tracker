import Redis from 'ioredis';
import { logger } from './logger';

// When REDIS_ENABLED=false, return a no-op mock client for local dev
const redisEnabled = process.env.REDIS_ENABLED !== 'false';

function createNoOpClient(): Redis {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      // Allow status check to return 'ready' so health check passes
      if (prop === 'status') return 'ready';
      if (prop === 'quit') return async () => 'OK';
      if (prop === 'on') return () => {};
      if (prop === 'call') return async () => null;
      // All Redis commands return safe defaults
      return async (..._args: unknown[]) => null;
    },
  };
  logger.warn('Redis is disabled (REDIS_ENABLED=false). Token caching and rate limiting are inactive.');
  return new Proxy({} as any, handler) as Redis;
}

function createRedisClient(): Redis {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.NODE_ENV === 'production' ? {} : undefined,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) {
        logger.error('Redis connection failed after max retries');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    lazyConnect: false,
    enableReadyCheck: true,
    connectTimeout: 5000,
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error('Redis error', { err: err.message }));
  client.on('close', () => logger.warn('Redis connection closed'));

  return client;
}

const redisClient: Redis = redisEnabled ? createRedisClient() : createNoOpClient();

export default redisClient;
