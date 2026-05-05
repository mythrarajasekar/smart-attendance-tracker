/**
 * Unit Tests — subject.service.ts
 */
jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn(), keys: jest.fn() },
}));
jest.mock('../subject.model', () => ({
  SubjectModel: {
    findOne: jest.fn(), findById: jest.fn(), create: jest.fn(),
    findByIdAndUpdate: jest.fn(), find: jest.fn(), countDocuments: jest.fn(),
    bulkWrite: jest.fn(),
  },
}));
jest.mock('../../users/user.model', () => ({
  UserModel: { find: jest.fn(), findById: jest.fn() },
}));

import redisClient from '../../../shared/utils/redisClient';
import { SubjectModel } from '../subject.model';
import { UserModel } from '../../users/user.model';
import * as subjectService from '../subject.service';
import { ConflictError, NotFoundError, BusinessRuleError, AuthorizationError } from '../../../shared/errors/AppError';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockSubject = SubjectModel as jest.Mocked<typeof SubjectModel>;
const mockUser = UserModel as jest.Mocked<typeof UserModel>;

const ADMIN_ID = 'admin123';
const SUBJECT_ID = 'subject123';

const MOCK_SUBJECT = {
  _id: { toString: () => SUBJECT_ID },
  name: 'Data Structures',
  code: 'CS301',
  department: 'Computer Science',
  semester: '3rd Sem',
  academicYear: '2024-2025',
  credits: 4,
  capacity: 50,
  isActive: true,
  facultyIds: [],
  studentIds: [],
};

beforeEach(() => jest.clearAllMocks());

describe('subjectService.createSubject', () => {
  it('creates subject successfully', async () => {
    mockSubject.findOne.mockResolvedValue(null);
    mockSubject.create.mockResolvedValue(MOCK_SUBJECT as never);
    mockRedis.keys.mockResolvedValue([]);

    const result = await subjectService.createSubject({
      name: 'Data Structures', code: 'CS301', department: 'Computer Science',
      semester: '3rd Sem', academicYear: '2024-2025', credits: 4,
    }, ADMIN_ID);

    expect(result).toBeDefined();
    expect(mockSubject.create).toHaveBeenCalledTimes(1);
  });

  it('throws DUPLICATE_SUBJECT_CODE on duplicate', async () => {
    mockSubject.findOne.mockResolvedValue(MOCK_SUBJECT as never);

    await expect(subjectService.createSubject({
      name: 'DS', code: 'CS301', department: 'CS', semester: '3rd Sem', academicYear: '2024-2025', credits: 4,
    }, ADMIN_ID)).rejects.toThrow(ConflictError);
  });
});

describe('subjectService.enrollStudents', () => {
  it('enrolls valid students and returns correct result', async () => {
    const subject = { ...MOCK_SUBJECT, studentIds: [], capacity: 50 };
    mockSubject.findById.mockResolvedValue(subject as never);
    mockUser.find.mockReturnValue({ select: jest.fn().mockResolvedValue([
      { _id: { toString: () => 'student1' } },
      { _id: { toString: () => 'student2' } },
    ]) } as never);
    mockSubject.bulkWrite.mockResolvedValue({} as never);
    mockRedis.del.mockResolvedValue(1);

    const result = await subjectService.enrollStudents(SUBJECT_ID, ['student1', 'student2'], ADMIN_ID);

    expect(result.enrolled).toBe(2);
    expect(result.alreadyEnrolled).toBe(0);
    expect(result.notFound).toBe(0);
  });

  it('skips already enrolled students (idempotent)', async () => {
    const subject = { ...MOCK_SUBJECT, studentIds: [{ toString: () => 'student1' }], capacity: 50 };
    mockSubject.findById.mockResolvedValue(subject as never);
    mockUser.find.mockReturnValue({ select: jest.fn().mockResolvedValue([
      { _id: { toString: () => 'student1' } },
    ]) } as never);
    mockSubject.bulkWrite.mockResolvedValue({} as never);
    mockRedis.del.mockResolvedValue(1);

    const result = await subjectService.enrollStudents(SUBJECT_ID, ['student1'], ADMIN_ID);

    expect(result.enrolled).toBe(0);
    expect(result.alreadyEnrolled).toBe(1);
  });

  it('rejects enrollment beyond capacity', async () => {
    const subject = { ...MOCK_SUBJECT, studentIds: Array(49).fill({ toString: () => 'x' }), capacity: 50 };
    mockSubject.findById.mockResolvedValue(subject as never);
    mockUser.find.mockReturnValue({ select: jest.fn().mockResolvedValue([
      { _id: { toString: () => 'new1' } },
      { _id: { toString: () => 'new2' } },
    ]) } as never);
    mockSubject.bulkWrite.mockResolvedValue({} as never);
    mockRedis.del.mockResolvedValue(1);

    const result = await subjectService.enrollStudents(SUBJECT_ID, ['new1', 'new2'], ADMIN_ID);

    expect(result.enrolled).toBe(1);
    expect(result.capacityExceeded).toBe(1);
  });

  it('throws SUBJECT_INACTIVE for inactive subject', async () => {
    mockSubject.findById.mockResolvedValue({ ...MOCK_SUBJECT, isActive: false } as never);

    await expect(subjectService.enrollStudents(SUBJECT_ID, ['student1'], ADMIN_ID))
      .rejects.toThrow(BusinessRuleError);
  });
});

describe('subjectService.getSubjectById', () => {
  it('throws AuthorizationError when faculty not assigned', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockSubject.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ ...MOCK_SUBJECT, facultyIds: [] }) } as never);

    await expect(subjectService.getSubjectById(SUBJECT_ID, 'faculty123', 'faculty'))
      .rejects.toThrow(AuthorizationError);
  });

  it('throws NotFoundError for non-existent subject', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockSubject.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) } as never);

    await expect(subjectService.getSubjectById('nonexistent', ADMIN_ID, 'admin'))
      .rejects.toThrow(NotFoundError);
  });
});
