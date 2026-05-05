/**
 * Integration Tests — Attendance Routes
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}));
jest.mock('../attendance.model', () => ({
  AttendanceSessionModel: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
  AttendanceRecordModel: { bulkWrite: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), aggregate: jest.fn(), find: jest.fn(), countDocuments: jest.fn() },
}));
jest.mock('../../subjects/subject.model', () => ({ SubjectModel: { findOne: jest.fn() } }));
jest.mock('../../auth/auth.service', () => ({ verifyAccessToken: jest.fn() }));
jest.mock('rate-limit-redis', () => jest.fn().mockImplementation(() => ({})));

import redisClient from '../../../shared/utils/redisClient';
import { AttendanceSessionModel, AttendanceRecordModel } from '../attendance.model';
import { SubjectModel } from '../../subjects/subject.model';
import * as authService from '../../auth/auth.service';
import attendanceRouter from '../attendance.routes';
import { correlationIdMiddleware } from '../../../shared/middleware/correlationId';
import { globalErrorHandler } from '../../../shared/middleware/errorHandler';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockSession = AttendanceSessionModel as jest.Mocked<typeof AttendanceSessionModel>;
const mockRecord = AttendanceRecordModel as jest.Mocked<typeof AttendanceRecordModel>;
const mockSubject = SubjectModel as jest.Mocked<typeof SubjectModel>;
const mockVerify = authService.verifyAccessToken as jest.MockedFunction<typeof authService.verifyAccessToken>;

const JWT_SECRET = 'test-secret-32-bytes-minimum-length!!';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use(globalErrorHandler);
  return app;
}

function makeFacultyToken() {
  return jwt.sign({ sub: 'faculty123', email: 'f@test.com', role: 'faculty', jti: 'j1' }, JWT_SECRET, { expiresIn: '15m' });
}
function makeStudentToken() {
  return jwt.sign({ sub: 'student123', email: 's@test.com', role: 'student', jti: 'j2' }, JWT_SECRET, { expiresIn: '15m' });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-bytes-min!!';
});

describe('POST /api/v1/attendance', () => {
  it('returns 403 for student trying to mark attendance', async () => {
    mockVerify.mockResolvedValue({ sub: 'student123', email: 's@test.com', role: 'student', jti: 'j2', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${makeStudentToken()}`)
      .send({ subjectId: 'a'.repeat(24), date: '2024-01-15', sessionLabel: 'Default', records: [{ studentId: 'b'.repeat(24), status: 'present' }] });

    expect(res.status).toBe(403);
  });

  it('returns 201 for faculty marking attendance', async () => {
    mockVerify.mockResolvedValue({ sub: 'faculty123', email: 'f@test.com', role: 'faculty', jti: 'j1', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockSubject.findOne.mockResolvedValue({ _id: 'subject123' } as never);
    mockSession.findOne.mockResolvedValue(null);
    mockSession.findOneAndUpdate.mockResolvedValue({ _id: 's1', sessionId: 'sid1', presentCount: 1, absentCount: 0 } as never);
    mockRecord.bulkWrite.mockResolvedValue({} as never);
    mockRedis.del.mockResolvedValue(1);
    mockRecord.aggregate.mockResolvedValue([{ total: 1, attended: 1, percentage: 100 }]);
    mockRedis.set.mockResolvedValue('OK');

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${makeFacultyToken()}`)
      .send({
        subjectId: 'a'.repeat(24),
        date: '2024-01-15',
        sessionLabel: 'Default',
        records: [{ studentId: 'b'.repeat(24), status: 'present' }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.marked).toBe(1);
  });

  it('returns 400 for future date', async () => {
    mockVerify.mockResolvedValue({ sub: 'faculty123', email: 'f@test.com', role: 'faculty', jti: 'j3', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);

    const app = buildApp();
    const futureDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${makeFacultyToken()}`)
      .send({ subjectId: 'a'.repeat(24), date: futureDate, sessionLabel: 'Default', records: [{ studentId: 'b'.repeat(24), status: 'present' }] });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/attendance/student/:studentId', () => {
  it('returns 200 for student viewing own history', async () => {
    mockVerify.mockResolvedValue({ sub: 'student123', email: 's@test.com', role: 'student', jti: 'j4', iat: 0, exp: 9999999999 });
    mockRedis.get.mockResolvedValue(null);
    mockRecord.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }) } as never);
    mockRecord.countDocuments.mockResolvedValue(0);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/attendance/student/student123')
      .set('Authorization', `Bearer ${makeStudentToken()}`);

    expect(res.status).toBe(200);
  });
});
