"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_middleware_1 = require("../auth/auth.middleware");
const auth_controller_1 = require("./auth.controller");
const router = (0, express_1.Router)();
const redisEnabled = process.env.REDIS_ENABLED !== 'false';
function makeStore() {
    if (!redisEnabled)
        return undefined;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RedisStore = require('rate-limit-redis');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const redisClient = require('../../shared/utils/redisClient').default;
    return new RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
}
// Login rate limiter: 10 requests per IP per minute
const loginLimiter = (0, express_rate_limit_1.default)({
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
const refreshLimiter = (0, express_rate_limit_1.default)({
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
router.post('/login', loginLimiter, auth_controller_1.loginHandler);
/**
 * POST /api/v1/auth/refresh
 * Public — refresh token is the credential
 */
router.post('/refresh', refreshLimiter, auth_controller_1.refreshHandler);
/**
 * POST /api/v1/auth/logout
 * Protected — requires valid access token
 */
router.post('/logout', (0, auth_middleware_1.authenticate)(), auth_controller_1.logoutHandler);
exports.default = router;
