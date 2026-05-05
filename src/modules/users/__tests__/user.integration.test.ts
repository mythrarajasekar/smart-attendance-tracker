/**
 * Integration Tests — User Routes
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}));
jest.mock('../user.model', () => ({
  UserModel: { findOne: jest.fn(), findById: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn(), find: jest.fn(), countDocuments: jest.fn() },
}));
jest.mock('../../auth/auth.service', () => ({
  verifyAccessToken: jest.fn(),
}));
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('sharp');
jest.mock('rate-limit-redis', () => jest.fn().mockImplementation(() => ({})));

import redisClient from '../../../shared/utils/redisClient';
import { UserModel } from '../user.model';
import * as authService from '../../auth/auth.service';
import userRouter from '../user.routes';
import { correlationIdMiddleware } from '../../../shared/middleware/correlationId';
import { globalErrorHandler } from '../../../shared/middleware/errorHandler';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockModel = UserModel as jest.Mocked<typeof UserModel>;
const mockVerify = authService.verifyAccessToken as jest.MockedFunction<typeof authService.verifyAccessToken>;

const JWT_SECRET = 'test-secret-32-bytes-minimum-length!!';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/api/v1/users', userRouter);
  app.use(globalErrorHandler);
  return app;
}

function makeToken(userId: string, role: string) {
  return jwt.sign({ sub: userId, email: 'test@test.com', role, jti: 'test-jti' }, JWT_SECRET, { expiresIn: '15m' });
}

const MOCK_STUDENT = {
  _id: { toString: () => 'student123' },
  email: 'student@test.com',
  role: 'student',
  name: 'Test Student',
  isActive: true,
  rollNumber: 'CS001',
  department: 'Computer Science',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-bytes-min!!';
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.S3_BUCKET = 'test-bucket';
});

describe('GET /api/v1/users/me', () => {
  it('returns 200 with profile for authenticated user', async () => {
    mockVerify.mockResolvedValue({ sub: 'student123', email: 'student@test.com', role: 'student', jti: 'j1', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(MOCK_STUDENT) } as never);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${makeToken('student123', 'student')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('student@test.com');
  });

  it('returns 401 without token', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/users (admin create)', () => {
  it('returns 403 for non-admin user', async () => {
    mockVerify.mockResolvedValue({ sub: 'student123', email: 'student@test.com', role: 'student', jti: 'j1', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${makeToken('student123', 'student')}`)
      .send({ email: 'new@test.com', password: 'Password1!', role: 'student', name: 'New', rollNumber: 'CS999', department: 'CS', yearSemester: '1st', academicYear: '2024-2025' });

    expect(res.status).toBe(403);
  });

  it('returns 201 for admin creating a student', async () => {
    mockVerify.mockResolvedValue({ sub: 'admin123', email: 'admin@test.com', role: 'admin', jti: 'j2', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockModel.findOne.mockResolvedValue(null);
    mockModel.create.mockResolvedValue(MOCK_STUDENT as never);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${makeToken('admin123', 'admin')}`)
      .send({ email: 'new@test.com', password: 'Password1!', role: 'student', name: 'New Student', rollNumber: 'CS999', department: 'CS', yearSemester: '1st Sem', academicYear: '2024-2025' });

    expect(res.status).toBe(201);
  });

  it('returns 400 on missing required fields', async () => {
    mockVerify.mockResolvedValue({ sub: 'admin123', email: 'admin@test.com', role: 'admin', jti: 'j3', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${makeToken('admin123', 'admin')}`)
      .send({ email: 'new@test.com', role: 'student' }); // missing required fields

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/users/:id (deactivate)', () => {
  it('returns 422 when admin tries to deactivate themselves', async () => {
    mockVerify.mockResolvedValue({ sub: 'admin123', email: 'admin@test.com', role: 'admin', jti: 'j4', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .delete('/api/v1/users/admin123')
      .set('Authorization', `Bearer ${makeToken('admin123', 'admin')}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
  });
});
