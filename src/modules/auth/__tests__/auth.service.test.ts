/**
 * Unit Tests — auth.service.ts
 * Tests business logic in isolation with mocked Redis and MongoDB.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies before importing the module under test
jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    call: jest.fn(),
  },
}));

jest.mock('../auth.model', () => ({
  UserModel: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

import redisClient from '../../../shared/utils/redisClient';
import { UserModel } from '../auth.model';
import * as authService from '../auth.service';
import { AuthenticationError, AccountLockedError } from '../../../shared/errors/AppError';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

const TEST_USER = {
  _id: { toString: () => 'user123' },
  email: 'test@example.com',
  passwordHash: bcrypt.hashSync('Password1!', 10),
  role: 'student' as const,
  name: 'Test Student',
  isActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-32-bytes-minimum-length!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-bytes-min!!';
});

describe('authService.login', () => {
  it('returns token pair on valid credentials', async () => {
    mockRedis.ttl.mockResolvedValue(-2); // not locked
    mockUserModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(TEST_USER),
    } as never);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    const result = await authService.login('test@example.com', 'Password1!', 'corr-1');

    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(result.tokens.expiresIn).toBe(900);
    expect(result.user.role).toBe('student');
  });

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    mockRedis.ttl.mockResolvedValue(-2);
    mockUserModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(TEST_USER),
    } as never);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    await expect(authService.login('test@example.com', 'WrongPass!', 'corr-2'))
      .rejects.toThrow(AuthenticationError);
  });

  it('throws INVALID_CREDENTIALS for non-existent user', async () => {
    mockRedis.ttl.mockResolvedValue(-2);
    mockUserModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as never);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    await expect(authService.login('nobody@example.com', 'Password1!', 'corr-3'))
      .rejects.toThrow(AuthenticationError);
  });

  it('throws INVALID_CREDENTIALS for deactivated user (same message as wrong password)', async () => {
    mockRedis.ttl.mockResolvedValue(-2);
    mockUserModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ ...TEST_USER, isActive: false }),
    } as never);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const err = await authService.login('test@example.com', 'Password1!', 'corr-4').catch(e => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('throws AccountLockedError when account is locked', async () => {
    mockRedis.ttl.mockResolvedValue(600); // 10 minutes remaining

    await expect(authService.login('test@example.com', 'Password1!', 'corr-5'))
      .rejects.toThrow(AccountLockedError);
  });

  it('locks account after 5 failed attempts', async () => {
    mockRedis.ttl.mockResolvedValue(-2);
    mockUserModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as never);
    mockRedis.incr.mockResolvedValue(5); // 5th attempt
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);

    await authService.login('test@example.com', 'wrong', 'corr-6').catch(() => {});

    expect(mockRedis.set).toHaveBeenCalledWith(
      'lock:test@example.com',
      '1',
      'EX',
      900
    );
  });
});

describe('authService.refreshTokens', () => {
  it('rotates refresh token and returns new pair', async () => {
    const userId = 'user123';
    const oldRefreshToken = jwt.sign(
      { sub: userId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d', jwtid: 'old-jti' }
    );

    mockRedis.get.mockResolvedValue(oldRefreshToken);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');
    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ email: 'test@example.com', role: 'student', isActive: true }),
    } as never);

    const result = await authService.refreshTokens(oldRefreshToken, 'corr-7');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(oldRefreshToken); // rotated
    expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${userId}`);
  });

  it('throws on invalid refresh token', async () => {
    await expect(authService.refreshTokens('invalid.token.here', 'corr-8'))
      .rejects.toThrow(AuthenticationError);
  });

  it('throws on replay attack (token not in Redis)', async () => {
    const token = jwt.sign(
      { sub: 'user123' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
    mockRedis.get.mockResolvedValue(null); // not in Redis

    await expect(authService.refreshTokens(token, 'corr-9'))
      .rejects.toThrow(AuthenticationError);
  });
});

describe('authService.verifyAccessToken', () => {
  it('returns payload for valid token', async () => {
    const token = jwt.sign(
      { sub: 'user123', email: 'test@example.com', role: 'student' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m', jwtid: 'test-jti' }
    );
    mockRedis.get.mockResolvedValue(null); // not blacklisted

    const payload = await authService.verifyAccessToken(token);
    expect(payload.sub).toBe('user123');
    expect(payload.role).toBe('student');
  });

  it('throws for blacklisted token', async () => {
    const token = jwt.sign(
      { sub: 'user123', email: 'test@example.com', role: 'student' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m', jwtid: 'blacklisted-jti' }
    );
    mockRedis.get.mockResolvedValue('1'); // blacklisted

    await expect(authService.verifyAccessToken(token))
      .rejects.toThrow(AuthenticationError);
  });

  it('throws for expired token', async () => {
    const token = jwt.sign(
      { sub: 'user123', email: 'test@example.com', role: 'student' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' } // already expired
    );

    await expect(authService.verifyAccessToken(token))
      .rejects.toThrow(AuthenticationError);
  });
});
