/**
 * Unit Tests — notification.service.ts
 */
jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));
jest.mock('../notification.model', () => ({
  NotificationModel: {
    create: jest.fn(), find: jest.fn(), findById: jest.fn(),
    findByIdAndUpdate: jest.fn(), updateMany: jest.fn(), deleteOne: jest.fn(),
    countDocuments: jest.fn(),
  },
}));
jest.mock('../../users/user.model', () => ({
  UserModel: { findById: jest.fn() },
}));
jest.mock('../../subjects/subject.model', () => ({
  SubjectModel: { findById: jest.fn() },
}));
jest.mock('@sendgrid/mail', () => ({ setApiKey: jest.fn(), send: jest.fn() }));
jest.mock('@aws-sdk/client-ses');

import redisClient from '../../../shared/utils/redisClient';
import { NotificationModel } from '../notification.model';
import { UserModel } from '../../users/user.model';
import { SubjectModel } from '../../subjects/subject.model';
import * as notificationService from '../notification.service';
import { AuthorizationError, NotFoundError } from '../../../shared/errors/AppError';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockNotif = NotificationModel as jest.Mocked<typeof NotificationModel>;
const mockUser = UserModel as jest.Mocked<typeof UserModel>;
const mockSubject = SubjectModel as jest.Mocked<typeof SubjectModel>;

const STUDENT_ID = 'student123';
const SUBJECT_ID = 'subject123';

beforeEach(() => jest.clearAllMocks());

describe('notificationService.checkAndAlert', () => {
  it('does not create notification when percentage >= threshold', async () => {
    await notificationService.checkAndAlert(STUDENT_ID, SUBJECT_ID, 80, 75);
    expect(mockNotif.create).not.toHaveBeenCalled();
  });

  it('suppresses duplicate alert within 24h (Redis key exists)', async () => {
    mockRedis.set.mockResolvedValue(null as unknown as 'OK'); // NX returns null if key exists

    await notificationService.checkAndAlert(STUDENT_ID, SUBJECT_ID, 60, 75);
    expect(mockNotif.create).not.toHaveBeenCalled();
  });

  it('creates notification when percentage < threshold and no duplicate', async () => {
    mockRedis.set.mockResolvedValue('OK'); // NX succeeds — first alert
    mockUser.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ name: 'Test Student', email: 'student@test.com' }) } as never);
    mockSubject.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ name: 'Data Structures', code: 'CS301' }) } as never);
    mockNotif.create.mockResolvedValue({ _id: { toString: () => 'notif1' } } as never);

    await notificationService.checkAndAlert(STUDENT_ID, SUBJECT_ID, 60, 75);

    expect(mockNotif.create).toHaveBeenCalledTimes(1);
    expect(mockNotif.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'low_attendance',
      read: false,
      emailStatus: 'pending',
    }));
  });
});

describe('notificationService.markAsRead', () => {
  it('throws NotFoundError for non-existent notification', async () => {
    mockNotif.findById.mockResolvedValue(null);
    await expect(notificationService.markAsRead('nonexistent', STUDENT_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws AuthorizationError when student tries to read another student notification', async () => {
    mockNotif.findById.mockResolvedValue({ _id: 'n1', userId: { toString: () => 'other_student' } } as never);
    await expect(notificationService.markAsRead('n1', STUDENT_ID)).rejects.toThrow(AuthorizationError);
  });

  it('marks notification as read successfully', async () => {
    mockNotif.findById.mockResolvedValue({ _id: 'n1', userId: { toString: () => STUDENT_ID } } as never);
    mockNotif.findByIdAndUpdate.mockResolvedValue({} as never);

    await expect(notificationService.markAsRead('n1', STUDENT_ID)).resolves.not.toThrow();
    expect(mockNotif.findByIdAndUpdate).toHaveBeenCalledWith('n1', expect.objectContaining({ $set: expect.objectContaining({ read: true }) }));
  });
});

describe('notificationService.getNotifications', () => {
  it('returns paginated notifications with unread count', async () => {
    mockNotif.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }) } as never);
    mockNotif.countDocuments.mockResolvedValueOnce(5).mockResolvedValueOnce(2);

    const result = await notificationService.getNotifications(STUDENT_ID, { page: 1, limit: 20 });

    expect(result.total).toBe(5);
    expect(result.unreadCount).toBe(2);
  });
});
