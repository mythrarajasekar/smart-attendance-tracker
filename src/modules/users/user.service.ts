import bcrypt from 'bcrypt';
import { FilterQuery } from 'mongoose';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { UserModel, IUser, ProfileAuditEntry } from './user.model';
import { UserRole } from '../auth/auth.model';
import redisClient from '../../shared/utils/redisClient';
import { logger } from '../../shared/utils/logger';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError,
} from '../../shared/errors/AppError';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const PROFILE_CACHE_TTL = 300; // 5 minutes
const LIST_PROJECTION = '-passwordHash -auditLog -profilePhotoKey -parentContact';

// ─── S3 Client ───────────────────────────────────────────────────────────────
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
});

const S3_BUCKET = process.env.S3_BUCKET!;

// ─── Cache helpers ───────────────────────────────────────────────────────────
async function getCachedProfile(userId: string): Promise<IUser | null> {
  try {
    const cached = await redisClient.get(`profile:${userId}`);
    if (cached) return JSON.parse(cached) as IUser;
  } catch { /* fall through */ }
  return null;
}

async function setCachedProfile(userId: string, profile: IUser): Promise<void> {
  try {
    await redisClient.set(`profile:${userId}`, JSON.stringify(profile), 'EX', PROFILE_CACHE_TTL);
  } catch { /* non-critical */ }
}

async function invalidateProfileCache(userId: string): Promise<void> {
  try {
    await redisClient.del(`profile:${userId}`);
  } catch { /* non-critical */ }
}

// ─── Optimistic concurrency update ──────────────────────────────────────────
async function updateWithConcurrency(
  userId: string,
  updates: Partial<IUser>,
  auditEntry: ProfileAuditEntry,
  maxRetries = 3
): Promise<IUser> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const current = await UserModel.findById(userId).select('+__v');
    if (!current) throw new NotFoundError('User');

    const result = await UserModel.findOneAndUpdate(
      { _id: userId, __v: current.__v },
      { $set: updates, $inc: { __v: 1 }, $push: { auditLog: auditEntry } },
      { new: true, select: LIST_PROJECTION }
    );

    if (result) return result;
    if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
  }
  throw new ConflictError('CONCURRENT_MODIFICATION', 'Profile was modified concurrently. Please retry.');
}

// ─── Allowed fields by role ──────────────────────────────────────────────────
const ALLOWED_UPDATE_FIELDS: Record<UserRole, string[]> = {
  student: ['name', 'phone', 'parentContact', 'yearSemester', 'profilePhotoUrl', 'profilePhotoKey'],
  faculty: ['name', 'phone', 'designation', 'profilePhotoUrl', 'profilePhotoKey'],
  admin: ['name', 'phone'],
};

// ─── Service functions ───────────────────────────────────────────────────────

export async function createUser(
  data: Record<string, unknown>,
  adminId: string
): Promise<IUser> {
  const { email, password, role, ...rest } = data as {
    email: string; password: string; role: UserRole; [key: string]: unknown;
  };

  // Uniqueness checks
  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) throw new ConflictError('Email already in use', 'DUPLICATE_EMAIL');

  if (role === 'student' && rest.rollNumber) {
    const dup = await UserModel.findOne({ rollNumber: rest.rollNumber });
    if (dup) throw new ConflictError('Roll number already in use', 'DUPLICATE_ROLL_NUMBER');
  }
  if (role === 'faculty' && rest.employeeId) {
    const dup = await UserModel.findOne({ employeeId: rest.employeeId });
    if (dup) throw new ConflictError('Employee ID already in use', 'DUPLICATE_EMPLOYEE_ID');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const auditEntry: ProfileAuditEntry = {
    changedBy: adminId as unknown as import('mongoose').Types.ObjectId,
    changedAt: new Date(),
    action: 'created',
    fields: Object.keys(rest),
    previousValues: {},
  };

  const user = await UserModel.create({
    email: email.toLowerCase(),
    passwordHash,
    role,
    ...rest,
    auditLog: [auditEntry],
  });

  logger.info('user.created', { adminId, userId: user._id.toString(), role });
  return user;
}

export async function getMyProfile(userId: string): Promise<IUser> {
  const cached = await getCachedProfile(userId);
  if (cached) return cached;

  const user = await UserModel.findById(userId).select(LIST_PROJECTION);
  if (!user) throw new NotFoundError('User');

  await setCachedProfile(userId, user);
  return user;
}

export async function updateMyProfile(
  userId: string,
  role: UserRole,
  updates: Record<string, unknown>
): Promise<IUser> {
  const allowed = ALLOWED_UPDATE_FIELDS[role];
  const forbidden = Object.keys(updates).filter(k => !allowed.includes(k));
  if (forbidden.length > 0) {
    throw new BusinessRuleError(`Fields not allowed for ${role}: ${forbidden.join(', ')}`, 'FORBIDDEN_FIELD');
  }

  const current = await UserModel.findById(userId).select(allowed.join(' '));
  if (!current) throw new NotFoundError('User');

  const previousValues: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    previousValues[key] = (current as unknown as Record<string, unknown>)[key];
  }

  const auditEntry: ProfileAuditEntry = {
    changedBy: userId as unknown as import('mongoose').Types.ObjectId,
    changedAt: new Date(),
    action: 'updated',
    fields: Object.keys(updates),
    previousValues,
  };

  const updated = await updateWithConcurrency(userId, updates as Partial<IUser>, auditEntry);
  await invalidateProfileCache(userId);
  return updated;
}

export async function getUserById(userId: string): Promise<IUser> {
  const cached = await getCachedProfile(userId);
  if (cached) return cached;

  const user = await UserModel.findById(userId).select(LIST_PROJECTION);
  if (!user) throw new NotFoundError('User');

  await setCachedProfile(userId, user);
  return user;
}

export async function listUsers(filters: {
  role?: UserRole;
  department?: string;
  academicYear?: string;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Promise<{ data: IUser[]; total: number; page: number; limit: number; totalPages: number }> {
  const query: FilterQuery<IUser> = { isActive: filters.isActive ?? true };

  if (filters.role) query.role = filters.role;
  if (filters.department) query.department = filters.department;
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  const skip = (filters.page - 1) * filters.limit;
  const sortDir = filters.sortOrder === 'desc' ? -1 : 1;

  const [data, total] = await Promise.all([
    UserModel.find(query)
      .select(LIST_PROJECTION)
      .sort({ [filters.sortBy]: sortDir })
      .skip(skip)
      .limit(filters.limit),
    UserModel.countDocuments(query),
  ]);

  return {
    data,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function adminUpdateUser(
  targetUserId: string,
  adminId: string,
  updates: Record<string, unknown>
): Promise<IUser> {
  const current = await UserModel.findById(targetUserId).select('+__v');
  if (!current) throw new NotFoundError('User');

  const previousValues: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    previousValues[key] = (current as unknown as Record<string, unknown>)[key];
  }

  const auditEntry: ProfileAuditEntry = {
    changedBy: adminId as unknown as import('mongoose').Types.ObjectId,
    changedAt: new Date(),
    action: 'updated',
    fields: Object.keys(updates),
    previousValues,
  };

  const updated = await updateWithConcurrency(targetUserId, updates as Partial<IUser>, auditEntry);
  await invalidateProfileCache(targetUserId);
  logger.info('user.admin_updated', { adminId, targetUserId, fields: Object.keys(updates) });
  return updated;
}

export async function deactivateUser(targetUserId: string, adminId: string): Promise<void> {
  if (targetUserId === adminId) {
    throw new BusinessRuleError('Administrators cannot deactivate their own account', 'CANNOT_DEACTIVATE_SELF');
  }

  const user = await UserModel.findById(targetUserId);
  if (!user) throw new NotFoundError('User');
  if (!user.isActive) throw new BusinessRuleError('User is already inactive', 'USER_ALREADY_INACTIVE');

  await UserModel.findByIdAndUpdate(targetUserId, {
    $set: { isActive: false },
    $push: {
      auditLog: {
        changedBy: adminId,
        changedAt: new Date(),
        action: 'deactivated',
        fields: ['isActive'],
        previousValues: { isActive: true },
      },
    },
  });

  // Invalidate tokens
  try {
    await redisClient.del(`refresh:${targetUserId}`);
    await redisClient.set(`blacklist:user:${targetUserId}`, '1', 'EX', 604800);
  } catch { /* non-critical */ }

  await invalidateProfileCache(targetUserId);
  logger.info('user.deactivated', { adminId, targetUserId });
}

export async function uploadProfilePhoto(
  userId: string,
  file: Express.Multer.File
): Promise<string> {
  // Process image
  const processed = await sharp(file.buffer)
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();

  const key = `profiles/${userId}/${uuidv4()}.webp`;

  // Upload to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: processed,
    ContentType: 'image/webp',
  }));

  // Generate pre-signed URL
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: 3600 }
  );

  // Get old key before update
  const user = await UserModel.findById(userId).select('+profilePhotoKey');
  const oldKey = user?.profilePhotoKey;

  // Update document
  await UserModel.findByIdAndUpdate(userId, {
    $set: { profilePhotoUrl: url, profilePhotoKey: key },
    $push: {
      auditLog: {
        changedBy: userId,
        changedAt: new Date(),
        action: 'photo_uploaded',
        fields: ['profilePhotoUrl', 'profilePhotoKey'],
        previousValues: { profilePhotoKey: oldKey ?? null },
      },
    },
  });

  // Delete old photo (non-blocking)
  if (oldKey) {
    s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey }))
      .catch(err => logger.warn('Failed to delete old profile photo', { oldKey, err: String(err) }));
  }

  await invalidateProfileCache(userId);
  return url;
}
