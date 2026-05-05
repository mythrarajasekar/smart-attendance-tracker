import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../auth/auth.middleware';
import {
  loginHandler, refreshHandler, logoutHandler,
} from './auth.controller';
import { ValidationError } from '../../shared/errors/AppError';

const router = Router();
const redisEnabled = process.env.REDIS_ENABLED !== 'false';

function makeStore() {
  if (!redisEnabled) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RedisStore = require('rate-limit-redis');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const redisClient = require('../../shared/utils/redisClient').default;
  return new RedisStore({ sendCommand: (...args: string[]) => redisClient.call(...args) });
}

// Login rate limiter: 10 requests per IP per minute
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisEnabled ? { store: makeStore() } : {}),
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many login attempts. Please try again later.' },
  },
});

// Refresh rate limiter: 30 requests per IP per minute
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisEnabled ? { store: makeStore() } : {}),
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many refresh requests. Please try again later.' },
  },
});

/**
 * POST /api/v1/auth/login
 * Public — no authentication required
 */
router.post('/login', loginLimiter, loginHandler);

/**
 * POST /api/v1/auth/refresh
 * Public — refresh token is the credential
 */
router.post('/refresh', refreshLimiter, refreshHandler);

/**
 * POST /api/v1/auth/logout
 * Protected — requires valid access token
 */
router.post('/logout', authenticate(), logoutHandler);

export default router;
