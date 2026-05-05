/**
 * Unit Tests — user.service.ts
 */
jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));
jest.mock('../user.model', () => ({ UserModel: { findOne: jest.fn(), findById: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn(), find: jest.fn(), countDocuments: jest.fn() } }));
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('sharp');

import redisClient from '../../../shared/utils/redisClient';
import { UserModel } from '../user.model';
import * as userService from '../user.service';
import { ConflictError, NotFoundError, BusinessRuleError } from '../../../shared/errors/AppError';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockModel = UserModel as jest.Mocked<typeof UserModel>;

const ADMIN_ID = 'admin123';
const STUDENT_ID = 'student123';

const MOCK_STUDENT = {
  _id: { toString: () => STUDENT_ID },
  email: 'student@test.com',
  role: 'student',
  name: 'Test Student',
  isActive: true,
  rollNumber: 'CS001',
  department: 'Computer Science',
};

beforeEach(() => jest.clearAllMocks());

describe('userService.createUser', () => {
  it('creates a student user successfully', async () => {
    mockModel.findOne.mockResolvedValue(null); // no duplicates
    mockModel.create.mockResolvedValue(MOCK_STUDENT as never);

    const result = await userService.createUser({
      email: 'student@test.com',
      password: 'Password1!',
      role: 'student',
      name: 'Test Student',
      rollNumber: 'CS001',
      department: 'Computer Science',
      yearSemester: '1st Sem',
      academicYear: '2024-2025',
    }, ADMIN_ID);

    expect(result).toBeDefined();
    expect(mockModel.create).toHaveBeenCalledTimes(1);
  });

  it('throws DUPLICATE_EMAIL on duplicate email', async () => {
    mockModel.findOne.mockResolvedValue(MOCK_STUDENT as never);

    await expect(userService.createUser({
      email: 'student@test.com', password: 'Password1!', role: 'student',
      name: 'X', rollNumber: 'CS002', department: 'CS', yearSemester: '1st', academicYear: '2024-2025',
    }, ADMIN_ID)).rejects.toThrow(ConflictError);
  });
});

describe('userService.getMyProfile', () => {
  it('returns cached profile on cache hit', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify(MOCK_STUDENT));

    const result = await userService.getMyProfile(STUDENT_ID);
    expect(result).toMatchObject({ email: 'student@test.com' });
    expect(mockModel.findById).not.toHaveBeenCalled();
  });

  it('fetches from MongoDB on cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(MOCK_STUDENT) } as never);

    const result = await userService.getMyProfile(STUDENT_ID);
    expect(result).toMatchObject({ email: 'student@test.com' });
    expect(mockModel.findById).toHaveBeenCalledWith(STUDENT_ID);
  });

  it('throws NotFoundError when user does not exist', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) } as never);

    await expect(userService.getMyProfile('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

describe('userService.deactivateUser', () => {
  it('throws CANNOT_DEACTIVATE_SELF when admin deactivates themselves', async () => {
    await expect(userService.deactivateUser(ADMIN_ID, ADMIN_ID)).rejects.toThrow(BusinessRuleError);
  });

  it('throws USER_ALREADY_INACTIVE for already inactive user', async () => {
    mockModel.findById.mockResolvedValue({ ...MOCK_STUDENT, isActive: false } as never);

    await expect(userService.deactivateUser(STUDENT_ID, ADMIN_ID)).rejects.toThrow(BusinessRuleError);
  });

  it('deactivates active user successfully', async () => {
    mockModel.findById.mockResolvedValue(MOCK_STUDENT as never);
    mockModel.findByIdAndUpdate.mockResolvedValue({ ...MOCK_STUDENT, isActive: false } as never);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    await expect(userService.deactivateUser(STUDENT_ID, ADMIN_ID)).resolves.not.toThrow();
    expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
      STUDENT_ID,
      expect.objectContaining({ $set: { isActive: false } })
    );
  });
});

describe('userService.updateMyProfile', () => {
  it('throws FORBIDDEN_FIELD when student tries to update department', async () => {
    await expect(userService.updateMyProfile(STUDENT_ID, 'student', { department: 'New Dept' }))
      .rejects.toThrow(BusinessRuleError);
  });

  it('throws FORBIDDEN_FIELD when student tries to update rollNumber', async () => {
    await expect(userService.updateMyProfile(STUDENT_ID, 'student', { rollNumber: 'NEW001' }))
      .rejects.toThrow(BusinessRuleError);
  });
});
