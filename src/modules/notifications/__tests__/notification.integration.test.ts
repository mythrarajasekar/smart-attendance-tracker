/**
 * Integration Tests — Notification Routes
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}));
jest.mock('../notification.model', () => ({
  NotificationModel: {
    create: jest.fn(), find: jest.fn(), findById: jest.fn(),
    findByIdAndUpdate: jest.fn(), updateMany: jest.fn(), deleteOne: jest.fn(),
    countDocuments: jest.fn(),
  },
}));
jest.mock('../../auth/auth.service', () => ({ verifyAccessToken: jest.fn() }));
jest.mock('rate-limit-redis', () => jest.fn().mockImplementation(() => ({})));
jest.mock('@sendgrid/mail', () => ({ setApiKey: jest.fn(), send: jest.fn() }));

import redisClient from '../../../shared/utils/redisClient';
import { NotificationModel } from '../notification.model';
import * as authService from '../../auth/auth.service';
import notificationRouter from '../notification.routes';
import { correlationIdMiddleware } from '../../../shared/middleware/correlationId';
import { globalErrorHandler } from '../../../shared/middleware/errorHandler';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockNotif = NotificationModel as jest.Mocked<typeof NotificationModel>;
const mockVerify = authService.verifyAccessToken as jest.MockedFunction<typeof authService.verifyAccessToken>;

const JWT_SECRET = 'test-secret-32-bytes-minimum-length!!';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/api/v1/notifications', notificationRouter);
  app.use(globalErrorHandler);
  return app;
}

function makeStudentToken() {
  return jwt.sign({ sub: 'student123', email: 's@test.com', role: 'student', jti: 'j1' }, JWT_SECRET, { expiresIn: '15m' });
}
function makeFacultyToken() {
  return jwt.sign({ sub: 'faculty123', email: 'f@test.com', role: 'faculty', jti: 'j2' }, JWT_SECRET, { expiresIn: '15m' });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-bytes-min!!';
});

describe('GET /api/v1/notifications', () => {
  it('returns 200 for student', async () => {
    mockVerify.mockResolvedValue({ sub: 'student123', email: 's@test.com', role: 'student', jti: 'j1', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockNotif.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }) } as never);
    mockNotif.countDocuments.mockResolvedValue(0);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${makeStudentToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.unreadCount).toBeDefined();
  });

  it('returns 403 for faculty (notifications are student-only)', async () => {
    mockVerify.mockResolvedValue({ sub: 'faculty123', email: 'f@test.com', role: 'faculty', jti: 'j2', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${makeFacultyToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/notifications/read-all', () => {
  it('marks all as read for student', async () => {
    mockVerify.mockResolvedValue({ sub: 'student123', email: 's@test.com', role: 'student', jti: 'j3', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockNotif.updateMany.mockResolvedValue({ modifiedCount: 3 } as never);

    const app = buildApp();
    const res = await request(app)
      .put('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${makeStudentToken()}`);

    expect(res.status).toBe(200);
  });
});
