"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = exports.logout = exports.refreshTokens = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const auth_model_1 = require("./auth.model");
const redisClient_1 = __importDefault(require("../../shared/utils/redisClient"));
const logger_1 = require("../../shared/utils/logger");
const AppError_1 = require("../../shared/errors/AppError");
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutes
// ─── Private helpers ────────────────────────────────────────────────────────
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET environment variable is not set');
    return secret;
}
function getJwtRefreshSecret() {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret)
        throw new Error('JWT_REFRESH_SECRET environment variable is not set');
    return secret;
}
async function redisOp(operation, context) {
    try {
        return await operation();
    }
    catch (err) {
        logger_1.logger.error(`Redis operation failed: ${context}`, { err });
        throw new AppError_1.ServiceUnavailableError('Authentication service temporarily unavailable');
    }
}
// ─── Public service functions ────────────────────────────────────────────────
/**
 * Validates credentials and issues a JWT token pair.
 * Implements brute-force protection via Redis.
 */
async function login(email, password, correlationId) {
    const normalizedEmail = email.toLowerCase().trim();
    // Check account lock
    const lockTTL = await redisOp(() => redisClient_1.default.ttl(`lock:${normalizedEmail}`), 'check account lock');
    if (lockTTL > 0) {
        logger_1.logger.warn('auth.login.locked', { correlationId, email: (0, logger_1.maskEmail)(normalizedEmail), retryAfter: lockTTL });
        throw new AppError_1.AccountLockedError(lockTTL);
    }
    // Find user (include passwordHash explicitly)
    const user = await auth_model_1.UserModel.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user || !user.isActive) {
        await incrementFailedAttempts(normalizedEmail, correlationId);
        logger_1.logger.warn('auth.login.failed', { correlationId, email: (0, logger_1.maskEmail)(normalizedEmail), reason: 'USER_NOT_FOUND_OR_INACTIVE' });
        throw new AppError_1.AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    const passwordMatch = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!passwordMatch) {
        await incrementFailedAttempts(normalizedEmail, correlationId);
        logger_1.logger.warn('auth.login.failed', { correlationId, email: (0, logger_1.maskEmail)(normalizedEmail), reason: 'INVALID_PASSWORD' });
        throw new AppError_1.AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    // Reset failed attempts on success
    await redisOp(() => redisClient_1.default.del(`attempts:${normalizedEmail}`), 'reset failed attempts');
    const tokens = await generateTokenPair(user._id.toString(), user.email, user.role);
    logger_1.logger.info('auth.login.success', {
        correlationId,
        userId: user._id.toString(),
        email: (0, logger_1.maskEmail)(user.email),
        role: user.role,
    });
    return {
        tokens,
        user: { id: user._id.toString(), name: user.name, role: user.role },
    };
}
exports.login = login;
/**
 * Rotates a refresh token — invalidates old, issues new pair.
 */
async function refreshTokens(incomingRefreshToken, correlationId) {
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(incomingRefreshToken, getJwtRefreshSecret());
    }
    catch {
        throw new AppError_1.AuthenticationError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }
    const userId = payload.sub;
    const storedToken = await redisOp(() => redisClient_1.default.get(`refresh:${userId}`), 'get refresh token');
    if (!storedToken || storedToken !== incomingRefreshToken) {
        logger_1.logger.warn('auth.refresh.replay_detected', { correlationId, userId });
        throw new AppError_1.AuthenticationError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }
    // Rotate: delete old, issue new
    await redisOp(() => redisClient_1.default.del(`refresh:${userId}`), 'delete old refresh token');
    const user = await auth_model_1.UserModel.findById(userId).select('email role isActive');
    if (!user || !user.isActive) {
        throw new AppError_1.AuthenticationError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }
    const tokens = await generateTokenPair(userId, user.email, user.role);
    logger_1.logger.info('auth.refresh.success', { correlationId, userId });
    return tokens;
}
exports.refreshTokens = refreshTokens;
/**
 * Blacklists the access token and deletes the refresh token.
 */
async function logout(userId, accessToken, _incomingRefreshToken, correlationId) {
    // Blacklist access token for its remaining lifetime
    try {
        const decoded = jsonwebtoken_1.default.decode(accessToken);
        if (decoded?.jti && decoded?.exp) {
            const remaining = decoded.exp - Math.floor(Date.now() / 1000);
            if (remaining > 0) {
                await redisOp(() => redisClient_1.default.set(`blacklist:${decoded.jti}`, '1', 'EX', remaining), 'blacklist access token');
            }
        }
    }
    catch {
        // Non-critical — continue with logout
    }
    // Delete refresh token
    try {
        await redisOp(() => redisClient_1.default.del(`refresh:${userId}`), 'delete refresh token');
    }
    catch {
        // Non-critical — continue with logout
    }
    logger_1.logger.info('auth.logout.success', { correlationId, userId });
}
exports.logout = logout;
/**
 * Verifies an access token and checks the Redis blacklist.
 */
async function verifyAccessToken(token) {
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, getJwtSecret());
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new AppError_1.AuthenticationError('Token has expired', 'TOKEN_EXPIRED');
        }
        throw new AppError_1.AuthenticationError('Invalid token', 'INVALID_TOKEN');
    }
    // Check blacklist
    const blacklisted = await redisOp(() => redisClient_1.default.get(`blacklist:${payload.jti}`), 'check token blacklist');
    if (blacklisted) {
        throw new AppError_1.AuthenticationError('Token has been revoked', 'TOKEN_REVOKED');
    }
    return payload;
}
exports.verifyAccessToken = verifyAccessToken;
// ─── Internal helpers ────────────────────────────────────────────────────────
async function generateTokenPair(userId, email, role) {
    const accessToken = jsonwebtoken_1.default.sign({ sub: userId, email, role }, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY, jwtid: (0, uuid_1.v4)() });
    const refreshToken = jsonwebtoken_1.default.sign({ sub: userId }, getJwtRefreshSecret(), { expiresIn: REFRESH_TOKEN_EXPIRY, jwtid: (0, uuid_1.v4)() });
    await redisOp(() => redisClient_1.default.set(`refresh:${userId}`, refreshToken, 'EX', REFRESH_TOKEN_TTL_SECONDS), 'store refresh token');
    return { accessToken, refreshToken, expiresIn: 900 };
}
async function incrementFailedAttempts(email, correlationId) {
    try {
        const count = await redisClient_1.default.incr(`attempts:${email}`);
        if (count === 1) {
            await redisClient_1.default.expire(`attempts:${email}`, LOCKOUT_TTL_SECONDS);
        }
        if (count >= MAX_FAILED_ATTEMPTS) {
            await redisClient_1.default.set(`lock:${email}`, '1', 'EX', LOCKOUT_TTL_SECONDS);
            await redisClient_1.default.del(`attempts:${email}`);
            logger_1.logger.warn('auth.account.locked', { correlationId, email: (0, logger_1.maskEmail)(email), attemptCount: count });
        }
    }
    catch (err) {
        logger_1.logger.error('Failed to increment failed attempts', { correlationId, err });
        // Non-critical — do not block the login error response
    }
}
