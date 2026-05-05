import crypto from 'crypto';
import mongoose, { FilterQuery } from 'mongoose';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { SubjectModel, ISubject, SubjectAuditEntry } from './subject.model';
import { UserModel } from '../users/user.model';
import redisClient from '../../shared/utils/redisClient';
import { logger } from '../../shared/utils/logger';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError,
  AuthorizationError,
} from '../../shared/errors/AppError';

const SUBJECT_DETAIL_TTL = 300;  // 5 minutes
const SUBJECT_LIST_TTL = 60;     // 1 minute
const SUBJECT_PROJECTION = '-auditLog';

export interface EnrollmentResult {
  enrolled: number;
  alreadyEnrolled: number;
  capacityExceeded: number;
  notFound: number;
  failed: Array<{ studentId: string; reason: string }>;
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

function hashQuery(query: object): string {
  return crypto.createHash('md5')
    .update(JSON.stringify(query, Object.keys(query).sort()))
    .digest('hex');
}

async function getSubjectCache(subjectId: string): Promise<ISubject | null> {
  try {
    const cached = await redisClient.get(`subjects:${subjectId}`);
    if (cached) return JSON.parse(cached) as ISubject;
  } catch { /* fall through */ }
  return null;
}

async function setSubjectCache(subjectId: string, subject: ISubject): Promise<void> {
  try {
    await redisClient.set(`subjects:${subjectId}`, JSON.stringify(subject), 'EX', SUBJECT_DETAIL_TTL);
  } catch { /* non-critical */ }
}

async function invalidateSubjectCache(subjectId: string): Promise<void> {
  try {
    await redisClient.del(`subjects:${subjectId}`);
  } catch { /* non-critical */ }
}

async function invalidateListCache(): Promise<void> {
  try {
    const keys = await redisClient.keys('subjects:list:*');
    if (keys.length > 0) await redisClient.del(...keys);
  } catch { /* non-critical */ }
}

// ─── Service functions ───────────────────────────────────────────────────────

export async function createSubject(
  data: Record<string, unknown>,
  adminId: string
): Promise<ISubject> {
  const code = (data.code as string).toUpperCase();
  const academicYear = data.academicYear as string;

  const existing = await SubjectModel.findOne({ code, academicYear });
  if (existing) throw new ConflictError(`Subject code ${code} already exists for ${academicYear}`, 'DUPLICATE_SUBJECT_CODE');

  const subject = await SubjectModel.create({
    ...data,
    code,
    isActive: true,
    facultyIds: [],
    studentIds: [],
    createdBy: adminId,
    auditLog: [{ changedBy: adminId, changedAt: new Date(), action: 'created', details: {} }],
  });

  await invalidateListCache();
  logger.info('subject.created', { adminId, subjectId: subject._id.toString(), code });
  return subject;
}

export async function listSubjects(
  userId: string,
  role: string,
  filters: {
    department?: string; semester?: string; academicYear?: string;
    isActive?: boolean; search?: string;
    page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc';
  }
): Promise<{ data: ISubject[]; total: number; page: number; limit: number; totalPages: number }> {
  const query: FilterQuery<ISubject> = { isActive: filters.isActive ?? true };

  // Role scoping
  if (role === 'faculty') query.facultyIds = userId as unknown as import('mongoose').Types.ObjectId;
  if (role === 'student') query.studentIds = userId as unknown as import('mongoose').Types.ObjectId;

  if (filters.department) query.department = filters.department;
  if (filters.semester) query.semester = filters.semester;
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.search) query.$text = { $search: filters.search };

  const cacheKey = `subjects:list:${hashQuery({ ...filters, userId: role !== 'admin' ? userId : 'admin' })}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* fall through */ }

  const skip = (filters.page - 1) * filters.limit;
  const sortDir = filters.sortOrder === 'desc' ? -1 : 1;

  const [data, total] = await Promise.all([
    SubjectModel.find(query)
      .select(SUBJECT_PROJECTION)
      .sort({ [filters.sortBy]: sortDir })
      .skip(skip)
      .limit(filters.limit),
    SubjectModel.countDocuments(query),
  ]);

  const result = { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };

  try {
    await redisClient.set(cacheKey, JSON.stringify(result), 'EX', SUBJECT_LIST_TTL);
  } catch { /* non-critical */ }

  return result;
}

export async function getSubjectById(
  subjectId: string,
  userId: string,
  role: string
): Promise<ISubject> {
  const cached = await getSubjectCache(subjectId);
  if (cached) {
    validateSubjectAccess(cached, userId, role);
    return cached;
  }

  const subject = await SubjectModel.findById(subjectId).select(SUBJECT_PROJECTION);
  if (!subject) throw new NotFoundError('Subject');

  validateSubjectAccess(subject, userId, role);
  await setSubjectCache(subjectId, subject);
  return subject;
}

function validateSubjectAccess(subject: ISubject, userId: string, role: string): void {
  if (role === 'faculty') {
    const isFaculty = subject.facultyIds.some(id => id.toString() === userId);
    if (!isFaculty) throw new AuthorizationError('You are not assigned to this subject');
  }
  if (role === 'student') {
    const isEnrolled = subject.studentIds.some(id => id.toString() === userId);
    if (!isEnrolled) throw new AuthorizationError('You are not enrolled in this subject');
  }
}

export async function updateSubject(
  subjectId: string,
  adminId: string,
  updates: Record<string, unknown>
): Promise<ISubject> {
  const subject = await SubjectModel.findById(subjectId);
  if (!subject) throw new NotFoundError('Subject');

  const updated = await SubjectModel.findByIdAndUpdate(
    subjectId,
    {
      $set: updates,
      $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'updated', details: { fields: Object.keys(updates) } } },
    },
    { new: true, select: SUBJECT_PROJECTION }
  );

  await invalidateSubjectCache(subjectId);
  await invalidateListCache();
  return updated!;
}

export async function deactivateSubject(subjectId: string, adminId: string): Promise<void> {
  const subject = await SubjectModel.findById(subjectId);
  if (!subject) throw new NotFoundError('Subject');
  if (!subject.isActive) throw new BusinessRuleError('Subject is already inactive', 'SUBJECT_ALREADY_INACTIVE');

  await SubjectModel.findByIdAndUpdate(subjectId, {
    $set: { isActive: false },
    $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'deactivated', details: {} } },
  });

  await invalidateSubjectCache(subjectId);
  await invalidateListCache();
  logger.info('subject.deactivated', { adminId, subjectId });
}

export async function assignFaculty(
  subjectId: string,
  facultyId: string,
  adminId: string
): Promise<void> {
  const [subject, faculty] = await Promise.all([
    SubjectModel.findById(subjectId),
    UserModel.findById(facultyId).select('role isActive'),
  ]);

  if (!subject || !subject.isActive) throw new NotFoundError('Subject');
  if (!faculty || faculty.role !== 'faculty') throw new BusinessRuleError('User is not a faculty member', 'NOT_A_FACULTY_USER');

  await SubjectModel.findByIdAndUpdate(subjectId, {
    $addToSet: { facultyIds: facultyId },
    $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'faculty_assigned', details: { facultyId } } },
  });

  await invalidateSubjectCache(subjectId);
}

export async function removeFaculty(
  subjectId: string,
  facultyId: string,
  adminId: string
): Promise<void> {
  const subject = await SubjectModel.findById(subjectId);
  if (!subject) throw new NotFoundError('Subject');

  await SubjectModel.findByIdAndUpdate(subjectId, {
    $pull: { facultyIds: facultyId as unknown as import('mongoose').Types.ObjectId },
    $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'faculty_removed', details: { facultyId } } },
  });

  await invalidateSubjectCache(subjectId);
}

export async function enrollStudents(
  subjectId: string,
  studentIds: string[],
  adminId: string
): Promise<EnrollmentResult> {
  const subject = await SubjectModel.findById(subjectId);
  if (!subject) throw new NotFoundError('Subject');
  if (!subject.isActive) throw new BusinessRuleError('Cannot enroll in inactive subject', 'SUBJECT_INACTIVE');

  const result: EnrollmentResult = { enrolled: 0, alreadyEnrolled: 0, capacityExceeded: 0, notFound: 0, failed: [] };

  // Validate student IDs exist and have student role
  const students = await UserModel.find({ _id: { $in: studentIds }, role: 'student' }).select('_id');
  const validStudentIds = new Set(students.map(s => s._id.toString()));

  const alreadyEnrolledIds = new Set(subject.studentIds.map(id => id.toString()));

  const toEnroll: string[] = [];

  for (const sid of studentIds) {
    if (!validStudentIds.has(sid)) {
      result.notFound++;
      result.failed.push({ studentId: sid, reason: 'Student not found' });
      continue;
    }
    if (alreadyEnrolledIds.has(sid)) {
      result.alreadyEnrolled++;
      continue;
    }
    toEnroll.push(sid);
  }

  // Capacity check
  if (subject.capacity !== null) {
    const available = subject.capacity - subject.studentIds.length;
    const excess = toEnroll.splice(available); // keep only what fits
    result.capacityExceeded = excess.length;
    excess.forEach(sid => result.failed.push({ studentId: sid, reason: 'Subject capacity exceeded' }));
  }

  if (toEnroll.length > 0) {
    await SubjectModel.bulkWrite([{
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(subjectId) },
        update: {
          $addToSet: { studentIds: { $each: toEnroll.map(id => new mongoose.Types.ObjectId(id)) } },
          $push: { auditLog: { changedBy: new mongoose.Types.ObjectId(adminId), changedAt: new Date(), action: 'student_enrolled', details: { count: toEnroll.length } } },
        },
      },
    }]);
    result.enrolled = toEnroll.length;
  }

  await invalidateSubjectCache(subjectId);
  return result;
}

export async function unenrollStudent(
  subjectId: string,
  studentId: string,
  adminId: string
): Promise<void> {
  const subject = await SubjectModel.findById(subjectId);
  if (!subject) throw new NotFoundError('Subject');

  await SubjectModel.findByIdAndUpdate(subjectId, {
    $pull: { studentIds: studentId as unknown as import('mongoose').Types.ObjectId },
    $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'student_unenrolled', details: { studentId } } },
  });

  await invalidateSubjectCache(subjectId);
}

export async function bulkEnrollCSV(
  subjectId: string,
  csvBuffer: Buffer,
  adminId: string
): Promise<EnrollmentResult & { parseErrors: Array<{ row: number; reason: string }> }> {
  // Parse CSV
  const rollNumbers = await parseEnrollmentCSV(csvBuffer);

  // Batch lookup by rollNumber
  const students = await UserModel.find({ rollNumber: { $in: rollNumbers }, role: 'student' }).select('_id rollNumber');
  const rollToId = new Map(students.map(s => [s.rollNumber!, s._id.toString()]));

  const studentIds: string[] = [];
  const parseErrors: Array<{ row: number; reason: string }> = [];

  rollNumbers.forEach((rn, idx) => {
    const sid = rollToId.get(rn);
    if (sid) {
      studentIds.push(sid);
    } else {
      parseErrors.push({ row: idx + 2, reason: `Roll number ${rn} not found` }); // +2: header + 1-based
    }
  });

  const enrollResult = await enrollStudents(subjectId, studentIds, adminId);
  return { ...enrollResult, parseErrors };
}

async function parseEnrollmentCSV(buffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const rollNumbers: string[] = [];
    let rowCount = 0;

    const parser = parse({ columns: true, skip_empty_lines: true, trim: true });

    parser.on('readable', () => {
      let record: Record<string, string>;
      while ((record = parser.read()) !== null) {
        rowCount++;
        if (rowCount > 1000) {
          parser.destroy();
          reject(new BusinessRuleError('CSV exceeds 1000 row limit', 'CSV_TOO_LARGE'));
          return;
        }
        if (!record.rollNumber) {
          parser.destroy();
          reject(new ValidationError('CSV must have a rollNumber column'));
          return;
        }
        rollNumbers.push(record.rollNumber.trim());
      }
    });

    parser.on('error', reject);
    parser.on('end', () => resolve([...new Set(rollNumbers)]));
    Readable.from(buffer).pipe(parser);
  });
}

export async function getEnrolledStudents(
  subjectId: string,
  userId: string,
  role: string,
  pagination: { page: number; limit: number }
): Promise<{ data: unknown[]; total: number; page: number; limit: number; totalPages: number }> {
  const subject = await SubjectModel.findById(subjectId).select('facultyIds studentIds isActive');
  if (!subject) throw new NotFoundError('Subject');

  // Faculty must be assigned to this subject
  if (role === 'faculty') {
    const isFaculty = subject.facultyIds.some(id => id.toString() === userId);
    if (!isFaculty) throw new AuthorizationError('You are not assigned to this subject');
  }

  const total = subject.studentIds.length;
  const skip = (pagination.page - 1) * pagination.limit;
  const studentIdSlice = subject.studentIds.slice(skip, skip + pagination.limit);

  const students = await UserModel.find({ _id: { $in: studentIdSlice } })
    .select('-passwordHash -auditLog -profilePhotoKey -parentContact');

  return {
    data: students,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
  };
}
