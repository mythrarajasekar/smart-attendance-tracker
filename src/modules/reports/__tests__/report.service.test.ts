/**
 * Unit Tests — report.service.ts
 */
jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn(), keys: jest.fn() },
}));
jest.mock('../../attendance/attendance.model', () => ({
  AttendanceRecordModel: { aggregate: jest.fn() },
}));
jest.mock('../../subjects/subject.model', () => ({
  SubjectModel: { findById: jest.fn() },
}));
jest.mock('../../users/user.model', () => ({
  UserModel: { findById: jest.fn() },
}));
jest.mock('pdfkit');
jest.mock('exceljs');

import redisClient from '../../../shared/utils/redisClient';
import { AttendanceRecordModel } from '../../attendance/attendance.model';
import { SubjectModel } from '../../subjects/subject.model';
import { UserModel } from '../../users/user.model';
import * as reportService from '../report.service';
import { AuthorizationError, NotFoundError } from '../../../shared/errors/AppError';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockAttendance = AttendanceRecordModel as jest.Mocked<typeof AttendanceRecordModel>;
const mockSubject = SubjectModel as jest.Mocked<typeof SubjectModel>;
const mockUser = UserModel as jest.Mocked<typeof UserModel>;

beforeEach(() => jest.clearAllMocks());

describe('reportService.generateStudentReport', () => {
  it('throws AuthorizationError when student requests another student report', async () => {
    await expect(
      reportService.generateStudentReport('student1', 'student', 'student2', 1, 2024, 'csv')
    ).rejects.toThrow(AuthorizationError);
  });

  it('throws AuthorizationError when faculty requests student report', async () => {
    await expect(
      reportService.generateStudentReport('faculty1', 'faculty', 'student1', 1, 2024, 'csv')
    ).rejects.toThrow(AuthorizationError);
  });

  it('throws NotFoundError for non-existent student', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockUser.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) } as never);

    await expect(
      reportService.generateStudentReport('admin1', 'admin', 'nonexistent', 1, 2024, 'csv')
    ).rejects.toThrow(NotFoundError);
  });

  it('returns CSV report for admin requesting student report', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockUser.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ name: 'Test Student', rollNumber: 'CS001' }),
    } as never);
    mockAttendance.aggregate.mockResolvedValue([
      { subjectId: 'sub1', subjectName: 'Math', subjectCode: 'MA101', department: 'CS', semester: '1st Sem', totalClasses: 20, attended: 15, percentage: 75 },
    ]);

    const result = await reportService.generateStudentReport('admin1', 'admin', 'student1', 1, 2024, 'csv');

    expect(result.mimeType).toBe('text/csv');
    expect(result.rowCount).toBe(1);
    expect(result.buffer).toBeDefined();
    expect(result.filename).toContain('.csv');
  });

  it('returns cached rows on cache hit', async () => {
    const cachedRows = [{ subjectCode: 'CS101', attended: 10, totalClasses: 12, percentage: 83.33 }];
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedRows));
    mockUser.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ name: 'Test Student', rollNumber: 'CS001' }),
    } as never);

    await reportService.generateStudentReport('student1', 'student', 'student1', 1, 2024, 'csv');

    expect(mockAttendance.aggregate).not.toHaveBeenCalled();
  });
});

describe('reportService.generateSubjectReport', () => {
  it('throws AuthorizationError when faculty not assigned to subject', async () => {
    mockSubject.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'sub1', name: 'Math', code: 'MA101', department: 'CS', semester: '1st Sem', facultyIds: [] }),
    } as never);

    await expect(
      reportService.generateSubjectReport('faculty1', 'faculty', 'sub1', 1, 2024, 'csv')
    ).rejects.toThrow(AuthorizationError);
  });
});
