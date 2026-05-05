/**
 * Integration Tests — Subject Routes
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn(), keys: jest.fn(), on: jest.fn() },
}));
jest.mock('../subject.model', () => ({
  SubjectModel: {
    findOne: jest.fn(), findById: jest.fn(), create: jest.fn(),
    findByIdAndUpdate: jest.fn(), find: jest.fn(), countDocuments: jest.fn(), bulkWrite: jest.fn(),
  },
}));
jest.mock('../../users/user.model', () => ({
  UserModel: { find: jest.fn(), findById: jest.fn() },
}));
jest.mock('../../auth/auth.service', () => ({ verifyAccessToken: jest.fn() }));
jest.mock('rate-limit-redis', () => jest.fn().mockImplementation(() => ({})));

import redisClient from '../../../shared/utils/redisClient';
import { SubjectModel } from '../subject.model';
import * as authService from '../../auth/auth.service';
import subjectRouter from '../subject.routes';
import { correlationIdMiddleware } from '../../../shared/middleware/correlationId';
import { globalErrorHandler } from '../../../shared/middleware/errorHandler';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockSubject = SubjectModel as jest.Mocked<typeof SubjectModel>;
const mockVerify = authService.verifyAccessToken as jest.MockedFunction<typeof authService.verifyAccessToken>;

const JWT_SECRET = 'test-secret-32-bytes-minimum-length!!';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/api/v1/subjects', subjectRouter);
  app.use(globalErrorHandler);
  return app;
}

const MOCK_SUBJECT = {
  _id: { toString: () => 'subject123' },
  name: 'Data Structures', code: 'CS301', department: 'Computer Science',
  semester: '3rd Sem', academicYear: '2024-2025', credits: 4,
  capacity: 50, isActive: true, facultyIds: [], studentIds: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-bytes-min!!';
});

function makeAdminToken() {
  return jwt.sign({ sub: 'admin123', email: 'admin@test.com', role: 'admin', jti: 'j1' }, JWT_SECRET, { expiresIn: '15m' });
}
function makeStudentToken() {
  return jwt.sign({ sub: 'student123', email: 'student@test.com', role: 'student', jti: 'j2' }, JWT_SECRET, { expiresIn: '15m' });
}

describe('POST /api/v1/subjects', () => {
  it('returns 201 for admin creating a subject', async () => {
    mockVerify.mockResolvedValue({ sub: 'admin123', email: 'admin@test.com', role: 'admin', jti: 'j1', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockSubject.findOne.mockResolvedValue(null);
    mockSubject.create.mockResolvedValue(MOCK_SUBJECT as never);
    mockRedis.keys.mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ name: 'Data Structures', code: 'CS301', department: 'Computer Science', semester: '3rd Sem', academicYear: '2024-2025', credits: 4 });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('CS301');
  });

  it('returns 403 for non-admin', async () => {
    mockVerify.mockResolvedValue({ sub: 'student123', email: 'student@test.com', role: 'student', jti: 'j2', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', `Bearer ${makeStudentToken()}`)
      .send({ name: 'DS', code: 'CS301', department: 'CS', semester: '3rd Sem', academicYear: '2024-2025', credits: 4 });

    expect(res.status).toBe(403);
  });

  it('returns 400 on invalid academic year format', async () => {
    mockVerify.mockResolvedValue({ sub: 'admin123', email: 'admin@test.com', role: 'admin', jti: 'j3', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ name: 'DS', code: 'CS301', department: 'CS', semester: '3rd Sem', academicYear: '2024', credits: 4 });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/subjects', () => {
  it('returns 200 with subject list', async () => {
    mockVerify.mockResolvedValue({ sub: 'admin123', email: 'admin@test.com', role: 'admin', jti: 'j4', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockSubject.find.mockReturnValue({ select: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([MOCK_SUBJECT]) }) }) }) } as never);
    mockSubject.countDocuments.mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/subjects')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });
});

describe('POST /api/v1/subjects/:id/students', () => {
  it('returns 409 for duplicate subject code', async () => {
    mockVerify.mockResolvedValue({ sub: 'admin123', email: 'admin@test.com', role: 'admin', jti: 'j5', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockSubject.findOne.mockResolvedValue(MOCK_SUBJECT as never);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ name: 'DS', code: 'CS301', department: 'CS', semester: '3rd Sem', academicYear: '2024-2025', credits: 4 });

    expect(res.status).toBe(409);
  });
});
