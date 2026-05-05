"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
// When REDIS_ENABLED=false, return a no-op mock client for local dev
const redisEnabled = process.env.REDIS_ENABLED !== 'false';
function createNoOpClient() {
    const handler = {
        get(_target, prop) {
            // Allow status check to return 'ready' so health check passes
            if (prop === 'status')
                return 'ready';
            if (prop === 'quit')
                return async () => 'OK';
            if (prop === 'on')
                return () => { };
            if (prop === 'call')
                return async () => null;
            // All Redis commands return safe defaults
            return async (..._args) => null;
        },
    };
    logger_1.logger.warn('Redis is disabled (REDIS_ENABLED=false). Token caching and rate limiting are inactive.');
    return new Proxy({}, handler);
}
function createRedisClient() {
    const client = new ioredis_1.default({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.NODE_ENV === 'production' ? {} : undefined,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
            if (times > 3) {
                logger_1.logger.error('Redis connection failed after max retries');
                return null;
            }
            return Math.min(times * 100, 3000);
        },
        lazyConnect: false,
        enableReadyCheck: true,
        connectTimeout: 5000,
    });
    client.on('connect', () => logger_1.logger.info('Redis connected'));
    client.on('error', (err) => logger_1.logger.error('Redis error', { err: err.message }));
    client.on('close', () => logger_1.logger.warn('Redis connection closed'));
    return client;
}
const redisClient = redisEnabled ? createRedisClient() : createNoOpClient();
exports.default = redisClient;
