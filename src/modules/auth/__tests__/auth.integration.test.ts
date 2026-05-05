/**
 * Integration Tests — Auth Routes
 * Tests the full HTTP request → controller → service → response flow.
 * Uses Supertest against an Express app instance.
 * MongoDB and Redis are mocked at the module level.
 */
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
    on: jest.fn(),
  },
}));

jest.mock('../auth.model', () => ({
  UserModel: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

// Mock rate-limit-redis to avoid Redis dependency in tests
jest.mock('rate-limit-redis', () => {
  return jest.fn().mockImplementation(() => ({}));
});

import redisClient from '../../../shared/utils/redisClient';
import { UserModel } from '../auth.model';
import authRouter from '../auth.routes';
import { correlationIdMiddleware } from '../../../shared/middleware/correlationId';
import { globalErrorHandler } from '../../../shared/middleware/errorHandler';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

// Build test Express app
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/api/v1/auth', authRouter);
  app.use(globalErrorHandler);
  return app;
}

const TEST_PASSWORD = 'Password1!';
const TEST_USER = {
  _id: { toString: () => 'user123' },
  email: 'student@test.com',
  passwordHash: bcrypt.hashSync(TEST_PASSWORD, 10),
  role: 'student' as const,
  name: 'Test Student',
  isActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-32-bytes-minimum-length!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-bytes-min!!';
});

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with token pair on valid credentials', async () => {
    mockRedis.ttl.mockResolvedValue(-2);
    mockUserModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(TEST_USER),
    } as never);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@test.com', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe('student');
  });

  it('returns 401 on invalid credentials', async () => {
    mockRedis.ttl.mockResolvedValue(-2);
    mockUserModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as never);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 423 when account is locked', async () => {
    mockRedis.ttl.mockResolvedValue(600);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@test.com', password: TEST_PASSWORD });

    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('returns 400 on missing email', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns x-correlation-id header', async () => {
    mockRedis.ttl.mockResolvedValue(-2);
    mockUserModel.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    } as never);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-correlation-id', 'my-trace-id')
      .send({ email: 'test@test.com', password: 'wrong' });

    expect(res.headers['x-correlation-id']).toBe('my-trace-id');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns 200 with new token pair on valid refresh token', async () => {
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
      select: jest.fn().mockResolvedValue({ email: 'student@test.com', role: 'student', isActive: true }),
    } as never);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(oldRefreshToken);
  });

  it('returns 401 on invalid refresh token', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid.token' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 and blacklists token', async () => {
    const accessToken = jwt.sign(
      { sub: 'user123', email: 'student@test.com', role: 'student' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m', jwtid: 'logout-jti' }
    );

    mockRedis.get.mockResolvedValue(null); // not blacklisted (for authenticate middleware)
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: 'some-refresh-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Logged out successfully');
  });

  it('returns 401 without Authorization header', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'some-token' });

    expect(res.status).toBe(401);
  });
});
