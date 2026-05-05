import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserModel, UserRole } from './auth.model';
import redisClient from '../../shared/utils/redisClient';
import { logger, maskEmail } from '../../shared/utils/logger';
import {
  AuthenticationError,
  AccountLockedError,
  ServiceUnavailableError,
} from '../../shared/errors/AppError';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutes

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

// ─── Private helpers ────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  return secret;
}

async function redisOp<T>(operation: () => Promise<T>, context: string): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    logger.error(`Redis operation failed: ${context}`, { err });
    throw new ServiceUnavailableError('Authentication service temporarily unavailable');
  }
}

// ─── Public service functions ────────────────────────────────────────────────

/**
 * Validates credentials and issues a JWT token pair.
 * Implements brute-force protection via Redis.
 */
export async function login(
  email: string,
  password: string,
  correlationId: string
): Promise<{ tokens: TokenPair; user: { id: string; name: string; role: UserRole } }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check account lock
  const lockTTL = await redisOp(
    () => redisClient.ttl(`lock:${normalizedEmail}`),
    'check account lock'
  );
  if (lockTTL > 0) {
    logger.warn('auth.login.locked', { correlationId, email: maskEmail(normalizedEmail), retryAfter: lockTTL });
    throw new AccountLockedError(lockTTL);
  }

  // Find user (include passwordHash explicitly)
  const user = await UserModel.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user || !user.isActive) {
    await incrementFailedAttempts(normalizedEmail, correlationId);
    logger.warn('auth.login.failed', { correlationId, email: maskEmail(normalizedEmail), reason: 'USER_NOT_FOUND_OR_INACTIVE' });
    throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await incrementFailedAttempts(normalizedEmail, correlationId);
    logger.warn('auth.login.failed', { correlationId, email: maskEmail(normalizedEmail), reason: 'INVALID_PASSWORD' });
    throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Reset failed attempts on success
  await redisOp(() => redisClient.del(`attempts:${normalizedEmail}`), 'reset failed attempts');

  const tokens = await generateTokenPair(user._id.toString(), user.email, user.role);

  logger.info('auth.login.success', {
    correlationId,
    userId: user._id.toString(),
    email: maskEmail(user.email),
    role: user.role,
  });

  return {
    tokens,
    user: { id: user._id.toString(), name: user.name, role: user.role },
  };
}

/**
 * Rotates a refresh token — invalidates old, issues new pair.
 */
export async function refreshTokens(
  incomingRefreshToken: string,
  correlationId: string
): Promise<TokenPair> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(incomingRefreshToken, getJwtRefreshSecret()) as RefreshTokenPayload;
  } catch {
    throw new AuthenticationError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const userId = payload.sub;
  const storedToken = await redisOp(
    () => redisClient.get(`refresh:${userId}`),
    'get refresh token'
  );

  if (!storedToken || storedToken !== incomingRefreshToken) {
    logger.warn('auth.refresh.replay_detected', { correlationId, userId });
    throw new AuthenticationError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Rotate: delete old, issue new
  await redisOp(() => redisClient.del(`refresh:${userId}`), 'delete old refresh token');

  const user = await UserModel.findById(userId).select('email role isActive');
  if (!user || !user.isActive) {
    throw new AuthenticationError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const tokens = await generateTokenPair(userId, user.email, user.role);

  logger.info('auth.refresh.success', { correlationId, userId });
  return tokens;
}

/**
 * Blacklists the access token and deletes the refresh token.
 */
export async function logout(
  userId: string,
  accessToken: string,
  _incomingRefreshToken: string,
  correlationId: string
): Promise<void> {
  // Blacklist access token for its remaining lifetime
  try {
    const decoded = jwt.decode(accessToken) as AccessTokenPayload | null;
    if (decoded?.jti && decoded?.exp) {
      const remaining = decoded.exp - Math.floor(Date.now() / 1000);
      if (remaining > 0) {
        await redisOp(
          () => redisClient.set(`blacklist:${decoded.jti}`, '1', 'EX', remaining),
          'blacklist access token'
        );
      }
    }
  } catch {
    // Non-critical — continue with logout
  }

  // Delete refresh token
  try {
    await redisOp(() => redisClient.del(`refresh:${userId}`), 'delete refresh token');
  } catch {
    // Non-critical — continue with logout
  }

  logger.info('auth.logout.success', { correlationId, userId });
}

/**
 * Verifies an access token and checks the Redis blacklist.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired', 'TOKEN_EXPIRED');
    }
    throw new AuthenticationError('Invalid token', 'INVALID_TOKEN');
  }

  // Check blacklist
  const blacklisted = await redisOp(
    () => redisClient.get(`blacklist:${payload.jti}`),
    'check token blacklist'
  );
  if (blacklisted) {
    throw new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED');
  }

  return payload;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function generateTokenPair(userId: string, email: string, role: UserRole): Promise<TokenPair> {
  const accessToken = jwt.sign(
    { sub: userId, email, role },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY, jwtid: uuidv4() }
  );

  const refreshToken = jwt.sign(
    { sub: userId },
    getJwtRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRY, jwtid: uuidv4() }
  );

  await redisOp(
    () => redisClient.set(`refresh:${userId}`, refreshToken, 'EX', REFRESH_TOKEN_TTL_SECONDS),
    'store refresh token'
  );

  return { accessToken, refreshToken, expiresIn: 900 };
}

async function incrementFailedAttempts(email: string, correlationId: string): Promise<void> {
  try {
    const count = await redisClient.incr(`attempts:${email}`);
    if (count === 1) {
      await redisClient.expire(`attempts:${email}`, LOCKOUT_TTL_SECONDS);
    }
    if (count >= MAX_FAILED_ATTEMPTS) {
      await redisClient.set(`lock:${email}`, '1', 'EX', LOCKOUT_TTL_SECONDS);
      await redisClient.del(`attempts:${email}`);
      logger.warn('auth.account.locked', { correlationId, email: maskEmail(email), attemptCount: count });
    }
  } catch (err) {
    logger.error('Failed to increment failed attempts', { correlationId, err });
    // Non-critical — do not block the login error response
  }
}
