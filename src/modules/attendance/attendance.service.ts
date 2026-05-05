import mongoose from 'mongoose';
import { AttendanceSessionModel, AttendanceRecordModel, IAttendanceRecord } from './attendance.model';
import { SubjectModel } from '../subjects/subject.model';
import redisClient from '../../shared/utils/redisClient';
import { logger } from '../../shared/utils/logger';
import {
  NotFoundError, AuthorizationError, BusinessRuleError, ConflictError,
} from '../../shared/errors/AppError';

const PCT_CACHE_TTL = 300; // 5 minutes

export interface AttendancePercentage {
  studentId: string;
  subjectId: string;
  attended: number;
  total: number;
  percentage: number;
  belowThreshold?: boolean;
}

export interface MarkResult {
  sessionId: string;
  marked: number;
  presentCount: number;
  absentCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSessionId(subjectId: string, date: Date, sessionLabel: string): string {
  const dateStr = date.toISOString().split('T')[0];
  return `${subjectId}_${dateStr}_${sessionLabel}`;
}

async function invalidatePctCache(studentId: string, subjectId: string): Promise<void> {
  try {
    await redisClient.del(`attendance:pct:${studentId}:${subjectId}`);
  } catch { /* non-critical */ }
}

// ─── Core service functions ───────────────────────────────────────────────────

export async function markAttendance(
  facultyId: string,
  data: {
    subjectId: string;
    date: Date;
    sessionLabel: string;
    records: Array<{ studentId: string; status: 'present' | 'absent' }>;
  }
): Promise<MarkResult> {
  const { subjectId, date, sessionLabel, records } = data;

  // Validate faculty is assigned to subject
  const subject = await SubjectModel.findOne({
    _id: subjectId,
    facultyIds: new mongoose.Types.ObjectId(facultyId),
    isActive: true,
  });
  if (!subject) throw new AuthorizationError('You are not assigned to this subject');

  const sessionId = buildSessionId(subjectId, date, sessionLabel);

  // Check for existing locked session
  const existingSession = await AttendanceSessionModel.findOne({ sessionId });
  if (existingSession?.isLocked) {
    throw new BusinessRuleError('This attendance session has been locked and cannot be modified', 'SESSION_LOCKED');
  }

  // Upsert session
  const session = await AttendanceSessionModel.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        subjectId, facultyId, date, sessionLabel,
        totalStudents: records.length,
        presentCount: records.filter(r => r.status === 'present').length,
        absentCount: records.filter(r => r.status === 'absent').length,
      },
      $setOnInsert: { isLocked: false, lockedAt: null, collegeId: null },
    },
    { upsert: true, new: true }
  );

  // Bulk upsert records (idempotent)
  const bulkOps = records.map(({ studentId, status }) => ({
    updateOne: {
      filter: { sessionId, studentId: new mongoose.Types.ObjectId(studentId) },
      update: {
        $set: {
          status, markedAt: new Date(), facultyId: new mongoose.Types.ObjectId(facultyId),
          subjectId: new mongoose.Types.ObjectId(subjectId), date,
          attendanceSessionId: session._id,
        },
        $setOnInsert: { editedAt: null, editedBy: null, editReason: null, collegeId: null },
      },
      upsert: true,
    },
  }));

  await AttendanceRecordModel.bulkWrite(bulkOps, { ordered: false });

  // Invalidate percentage caches and trigger alerts
  await Promise.all(
    records.map(async ({ studentId }) => {
      await invalidatePctCache(studentId, subjectId);
      // Alert check is async and non-blocking
      calculateAndCachePercentage(studentId, subjectId).catch(err =>
        logger.error('percentage recalc failed', { studentId, subjectId, err })
      );
    })
  );

  logger.info('attendance.marked', { facultyId, subjectId, sessionId, count: records.length });

  return {
    sessionId,
    marked: records.length,
    presentCount: session.presentCount,
    absentCount: session.absentCount,
  };
}

export async function editAttendanceRecord(
  recordId: string,
  facultyId: string,
  data: { status: 'present' | 'absent'; editReason: string }
): Promise<IAttendanceRecord> {
  const record = await AttendanceRecordModel.findById(recordId);
  if (!record) throw new NotFoundError('Attendance record');

  // Validate faculty owns the subject
  const subject = await SubjectModel.findOne({
    _id: record.subjectId,
    facultyIds: new mongoose.Types.ObjectId(facultyId),
  });
  if (!subject) throw new AuthorizationError('You are not assigned to this subject');

  // Check session lock
  const session = await AttendanceSessionModel.findOne({ sessionId: record.sessionId });
  if (session?.isLocked) throw new BusinessRuleError('Session is locked', 'SESSION_LOCKED');

  // Check correction window (default 24h)
  const correctionWindowMs = 24 * 60 * 60 * 1000; // 24 hours
  if (Date.now() - record.markedAt.getTime() > correctionWindowMs) {
    throw new BusinessRuleError('Correction window has expired (24 hours)', 'CORRECTION_WINDOW_EXPIRED');
  }

  const updated = await AttendanceRecordModel.findByIdAndUpdate(
    recordId,
    {
      $set: {
        status: data.status,
        editedAt: new Date(),
        editedBy: new mongoose.Types.ObjectId(facultyId),
        editReason: data.editReason,
      },
    },
    { new: true }
  );

  await invalidatePctCache(record.studentId.toString(), record.subjectId.toString());
  calculateAndCachePercentage(record.studentId.toString(), record.subjectId.toString()).catch(() => {});

  return updated!;
}

export async function lockSession(sessionId: string, facultyId: string): Promise<void> {
  const session = await AttendanceSessionModel.findOne({ sessionId });
  if (!session) throw new NotFoundError('Attendance session');
  if (session.facultyId.toString() !== facultyId) throw new AuthorizationError('Not your session');
  if (session.isLocked) return; // idempotent

  const result = await AttendanceSessionModel.findOneAndUpdate(
    { sessionId, __v: (session as unknown as { __v: number }).__v, isLocked: false },
    { $set: { isLocked: true, lockedAt: new Date() }, $inc: { __v: 1 } },
    { new: true }
  );
  if (!result) throw new ConflictError('SESSION_LOCK_CONFLICT', 'Session was modified concurrently');
}

export async function calculateAndCachePercentage(
  studentId: string,
  subjectId: string
): Promise<AttendancePercentage> {
  // Check cache first
  try {
    const cached = await redisClient.get(`attendance:pct:${studentId}:${subjectId}`);
    if (cached) return JSON.parse(cached) as AttendancePercentage;
  } catch { /* fall through */ }

  const [result] = await AttendanceRecordModel.aggregate([
    {
      $match: {
        studentId: new mongoose.Types.ObjectId(studentId),
        subjectId: new mongoose.Types.ObjectId(subjectId),
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        attended: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        attended: 1,
        percentage: {
          $cond: [
            { $eq: ['$total', 0] },
            0,
            { $round: [{ $multiply: [{ $divide: ['$attended', '$total'] }, 100] }, 2] },
          ],
        },
      },
    },
  ]);

  const pct: AttendancePercentage = result
    ? { studentId, subjectId, ...result }
    : { studentId, subjectId, total: 0, attended: 0, percentage: 0 };

  try {
    await redisClient.set(
      `attendance:pct:${studentId}:${subjectId}`,
      JSON.stringify(pct),
      'EX', PCT_CACHE_TTL
    );
  } catch { /* non-critical */ }

  return pct;
}

export async function getSubjectAttendance(
  subjectId: string,
  userId: string,
  role: string,
  filters: { month?: number; year?: number; page: number; limit: number }
): Promise<{ data: unknown[]; total: number; page: number; limit: number; totalPages: number }> {
  // Faculty must be assigned
  if (role === 'faculty') {
    const subject = await SubjectModel.findOne({ _id: subjectId, facultyIds: new mongoose.Types.ObjectId(userId) });
    if (!subject) throw new AuthorizationError('Not assigned to this subject');
  }

  const matchStage: Record<string, unknown> = { subjectId: new mongoose.Types.ObjectId(subjectId) };
  if (filters.month && filters.year) {
    const start = new Date(filters.year, filters.month - 1, 1);
    const end = new Date(filters.year, filters.month, 0, 23, 59, 59);
    matchStage.date = { $gte: start, $lte: end };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$studentId',
        total: { $sum: 1 },
        attended: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      },
    },
    {
      $project: {
        studentId: '$_id',
        total: 1,
        attended: 1,
        percentage: {
          $cond: [
            { $eq: ['$total', 0] }, 0,
            { $round: [{ $multiply: [{ $divide: ['$attended', '$total'] }, 100] }, 2] },
          ],
        },
      },
    },
    { $sort: { percentage: 1 } },
  ];

  const [countResult, data] = await Promise.all([
    AttendanceRecordModel.aggregate([...pipeline, { $count: 'total' }] as mongoose.PipelineStage[]),
    AttendanceRecordModel.aggregate([
      ...pipeline,
      { $skip: (filters.page - 1) * filters.limit },
      { $limit: filters.limit },
    ] as mongoose.PipelineStage[]),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
}

export async function getStudentAttendanceHistory(
  studentId: string,
  requesterId: string,
  requesterRole: string,
  filters: { subjectId?: string; month?: number; year?: number; page: number; limit: number }
): Promise<{ data: IAttendanceRecord[]; total: number; page: number; limit: number; totalPages: number }> {
  if (requesterRole === 'student' && studentId !== requesterId) {
    throw new AuthorizationError('Cannot view another student\'s attendance');
  }

  const query: Record<string, unknown> = { studentId: new mongoose.Types.ObjectId(studentId) };
  if (filters.subjectId) query.subjectId = new mongoose.Types.ObjectId(filters.subjectId);
  if (filters.month && filters.year) {
    const start = new Date(filters.year, filters.month - 1, 1);
    const end = new Date(filters.year, filters.month, 0, 23, 59, 59);
    query.date = { $gte: start, $lte: end };
  }

  const skip = (filters.page - 1) * filters.limit;
  const [data, total] = await Promise.all([
    AttendanceRecordModel.find(query).sort({ date: -1 }).skip(skip).limit(filters.limit),
    AttendanceRecordModel.countDocuments(query),
  ]);

  return { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
}
