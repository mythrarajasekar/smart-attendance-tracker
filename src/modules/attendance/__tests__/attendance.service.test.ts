/**
 * Unit Tests — attendance.service.ts
 */
jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));
jest.mock('../attendance.model', () => ({
  AttendanceSessionModel: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
  AttendanceRecordModel: { bulkWrite: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), aggregate: jest.fn(), find: jest.fn(), countDocuments: jest.fn() },
}));
jest.mock('../../subjects/subject.model', () => ({
  SubjectModel: { findOne: jest.fn() },
}));

import redisClient from '../../../shared/utils/redisClient';
import { AttendanceSessionModel, AttendanceRecordModel } from '../attendance.model';
import { SubjectModel } from '../../subjects/subject.model';
import * as attendanceService from '../attendance.service';
import { AuthorizationError, BusinessRuleError } from '../../../shared/errors/AppError';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockSession = AttendanceSessionModel as jest.Mocked<typeof AttendanceSessionModel>;
const mockRecord = AttendanceRecordModel as jest.Mocked<typeof AttendanceRecordModel>;
const mockSubject = SubjectModel as jest.Mocked<typeof SubjectModel>;

const FACULTY_ID = 'faculty123';
const SUBJECT_ID = 'subject123';

beforeEach(() => jest.clearAllMocks());

describe('attendanceService.markAttendance', () => {
  it('throws AuthorizationError when faculty not assigned', async () => {
    mockSubject.findOne.mockResolvedValue(null);

    await expect(attendanceService.markAttendance(FACULTY_ID, {
      subjectId: SUBJECT_ID,
      date: new Date(),
      sessionLabel: 'Default',
      records: [{ studentId: 'student1', status: 'present' }],
    })).rejects.toThrow(AuthorizationError);
  });

  it('throws SESSION_LOCKED for locked session', async () => {
    mockSubject.findOne.mockResolvedValue({ _id: SUBJECT_ID } as never);
    mockSession.findOne.mockResolvedValue({ isLocked: true } as never);

    await expect(attendanceService.markAttendance(FACULTY_ID, {
      subjectId: SUBJECT_ID,
      date: new Date(),
      sessionLabel: 'Default',
      records: [{ studentId: 'student1', status: 'present' }],
    })).rejects.toThrow(BusinessRuleError);
  });

  it('marks attendance successfully', async () => {
    mockSubject.findOne.mockResolvedValue({ _id: SUBJECT_ID } as never);
    mockSession.findOne.mockResolvedValue(null); // no existing session
    mockSession.findOneAndUpdate.mockResolvedValue({
      _id: 'session1', sessionId: 'sid1', presentCount: 1, absentCount: 0,
    } as never);
    mockRecord.bulkWrite.mockResolvedValue({} as never);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);
    mockRecord.aggregate.mockResolvedValue([{ total: 1, attended: 1, percentage: 100 }]);
    mockRedis.set.mockResolvedValue('OK');

    const result = await attendanceService.markAttendance(FACULTY_ID, {
      subjectId: SUBJECT_ID,
      date: new Date(),
      sessionLabel: 'Default',
      records: [{ studentId: 'student1', status: 'present' }],
    });

    expect(result.marked).toBe(1);
    expect(mockRecord.bulkWrite).toHaveBeenCalledTimes(1);
  });
});

describe('attendanceService.calculateAndCachePercentage', () => {
  it('returns cached value on cache hit', async () => {
    const cached = { studentId: 's1', subjectId: 'sub1', total: 10, attended: 8, percentage: 80 };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await attendanceService.calculateAndCachePercentage('s1', 'sub1');
    expect(result.percentage).toBe(80);
    expect(mockRecord.aggregate).not.toHaveBeenCalled();
  });

  it('returns 0 percentage when no records exist', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRecord.aggregate.mockResolvedValue([]); // no records
    mockRedis.set.mockResolvedValue('OK');

    const result = await attendanceService.calculateAndCachePercentage('s1', 'sub1');
    expect(result.percentage).toBe(0);
    expect(result.total).toBe(0);
  });

  it('calculates correct percentage from aggregation', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRecord.aggregate.mockResolvedValue([{ total: 20, attended: 15, percentage: 75 }]);
    mockRedis.set.mockResolvedValue('OK');

    const result = await attendanceService.calculateAndCachePercentage('s1', 'sub1');
    expect(result.percentage).toBe(75);
    expect(result.attended).toBe(15);
    expect(result.total).toBe(20);
  });
});

describe('attendanceService.editAttendanceRecord', () => {
  it('throws CORRECTION_WINDOW_EXPIRED for old records', async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    mockRecord.findById.mockResolvedValue({
      _id: 'rec1', subjectId: SUBJECT_ID, sessionId: 'sid1', markedAt: oldDate,
    } as never);
    mockSubject.findOne.mockResolvedValue({ _id: SUBJECT_ID } as never);
    mockSession.findOne.mockResolvedValue({ isLocked: false } as never);

    await expect(attendanceService.editAttendanceRecord('rec1', FACULTY_ID, { status: 'absent', editReason: 'Correction' }))
      .rejects.toThrow(BusinessRuleError);
  });
});
