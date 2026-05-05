"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentAttendanceHistory = exports.getSubjectAttendance = exports.calculateAndCachePercentage = exports.lockSession = exports.editAttendanceRecord = exports.markAttendance = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const attendance_model_1 = require("./attendance.model");
const subject_model_1 = require("../subjects/subject.model");
const redisClient_1 = __importDefault(require("../../shared/utils/redisClient"));
const logger_1 = require("../../shared/utils/logger");
const AppError_1 = require("../../shared/errors/AppError");
const PCT_CACHE_TTL = 300; // 5 minutes
// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildSessionId(subjectId, date, sessionLabel) {
    const dateStr = date.toISOString().split('T')[0];
    return `${subjectId}_${dateStr}_${sessionLabel}`;
}
async function invalidatePctCache(studentId, subjectId) {
    try {
        await redisClient_1.default.del(`attendance:pct:${studentId}:${subjectId}`);
    }
    catch { /* non-critical */ }
}
// ─── Core service functions ───────────────────────────────────────────────────
async function markAttendance(facultyId, data) {
    const { subjectId, date, sessionLabel, records } = data;
    // Validate faculty is assigned to subject
    const subject = await subject_model_1.SubjectModel.findOne({
        _id: subjectId,
        facultyIds: new mongoose_1.default.Types.ObjectId(facultyId),
        isActive: true,
    });
    if (!subject)
        throw new AppError_1.AuthorizationError('You are not assigned to this subject');
    const sessionId = buildSessionId(subjectId, date, sessionLabel);
    // Check for existing locked session
    const existingSession = await attendance_model_1.AttendanceSessionModel.findOne({ sessionId });
    if (existingSession?.isLocked) {
        throw new AppError_1.BusinessRuleError('This attendance session has been locked and cannot be modified', 'SESSION_LOCKED');
    }
    // Upsert session
    const session = await attendance_model_1.AttendanceSessionModel.findOneAndUpdate({ sessionId }, {
        $set: {
            subjectId, facultyId, date, sessionLabel,
            totalStudents: records.length,
            presentCount: records.filter(r => r.status === 'present').length,
            absentCount: records.filter(r => r.status === 'absent').length,
        },
        $setOnInsert: { isLocked: false, lockedAt: null, collegeId: null },
    }, { upsert: true, new: true });
    // Bulk upsert records (idempotent)
    const bulkOps = records.map(({ studentId, status }) => ({
        updateOne: {
            filter: { sessionId, studentId: new mongoose_1.default.Types.ObjectId(studentId) },
            update: {
                $set: {
                    status, markedAt: new Date(), facultyId: new mongoose_1.default.Types.ObjectId(facultyId),
                    subjectId: new mongoose_1.default.Types.ObjectId(subjectId), date,
                    attendanceSessionId: session._id,
                },
                $setOnInsert: { editedAt: null, editedBy: null, editReason: null, collegeId: null },
            },
            upsert: true,
        },
    }));
    await attendance_model_1.AttendanceRecordModel.bulkWrite(bulkOps, { ordered: false });
    // Invalidate percentage caches and trigger alerts
    await Promise.all(records.map(async ({ studentId }) => {
        await invalidatePctCache(studentId, subjectId);
        // Alert check is async and non-blocking
        calculateAndCachePercentage(studentId, subjectId).catch(err => logger_1.logger.error('percentage recalc failed', { studentId, subjectId, err }));
    }));
    logger_1.logger.info('attendance.marked', { facultyId, subjectId, sessionId, count: records.length });
    return {
        sessionId,
        marked: records.length,
        presentCount: session.presentCount,
        absentCount: session.absentCount,
    };
}
exports.markAttendance = markAttendance;
async function editAttendanceRecord(recordId, facultyId, data) {
    const record = await attendance_model_1.AttendanceRecordModel.findById(recordId);
    if (!record)
        throw new AppError_1.NotFoundError('Attendance record');
    // Validate faculty owns the subject
    const subject = await subject_model_1.SubjectModel.findOne({
        _id: record.subjectId,
        facultyIds: new mongoose_1.default.Types.ObjectId(facultyId),
    });
    if (!subject)
        throw new AppError_1.AuthorizationError('You are not assigned to this subject');
    // Check session lock
    const session = await attendance_model_1.AttendanceSessionModel.findOne({ sessionId: record.sessionId });
    if (session?.isLocked)
        throw new AppError_1.BusinessRuleError('Session is locked', 'SESSION_LOCKED');
    // Check correction window (default 24h)
    const correctionWindowMs = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - record.markedAt.getTime() > correctionWindowMs) {
        throw new AppError_1.BusinessRuleError('Correction window has expired (24 hours)', 'CORRECTION_WINDOW_EXPIRED');
    }
    const updated = await attendance_model_1.AttendanceRecordModel.findByIdAndUpdate(recordId, {
        $set: {
            status: data.status,
            editedAt: new Date(),
            editedBy: new mongoose_1.default.Types.ObjectId(facultyId),
            editReason: data.editReason,
        },
    }, { new: true });
    await invalidatePctCache(record.studentId.toString(), record.subjectId.toString());
    calculateAndCachePercentage(record.studentId.toString(), record.subjectId.toString()).catch(() => { });
    return updated;
}
exports.editAttendanceRecord = editAttendanceRecord;
async function lockSession(sessionId, facultyId) {
    const session = await attendance_model_1.AttendanceSessionModel.findOne({ sessionId });
    if (!session)
        throw new AppError_1.NotFoundError('Attendance session');
    if (session.facultyId.toString() !== facultyId)
        throw new AppError_1.AuthorizationError('Not your session');
    if (session.isLocked)
        return; // idempotent
    const result = await attendance_model_1.AttendanceSessionModel.findOneAndUpdate({ sessionId, __v: session.__v, isLocked: false }, { $set: { isLocked: true, lockedAt: new Date() }, $inc: { __v: 1 } }, { new: true });
    if (!result)
        throw new AppError_1.ConflictError('SESSION_LOCK_CONFLICT', 'Session was modified concurrently');
}
exports.lockSession = lockSession;
async function calculateAndCachePercentage(studentId, subjectId) {
    // Check cache first
    try {
        const cached = await redisClient_1.default.get(`attendance:pct:${studentId}:${subjectId}`);
        if (cached)
            return JSON.parse(cached);
    }
    catch { /* fall through */ }
    const [result] = await attendance_model_1.AttendanceRecordModel.aggregate([
        {
            $match: {
                studentId: new mongoose_1.default.Types.ObjectId(studentId),
                subjectId: new mongoose_1.default.Types.ObjectId(subjectId),
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
    const pct = result
        ? { studentId, subjectId, ...result }
        : { studentId, subjectId, total: 0, attended: 0, percentage: 0 };
    try {
        await redisClient_1.default.set(`attendance:pct:${studentId}:${subjectId}`, JSON.stringify(pct), 'EX', PCT_CACHE_TTL);
    }
    catch { /* non-critical */ }
    return pct;
}
exports.calculateAndCachePercentage = calculateAndCachePercentage;
async function getSubjectAttendance(subjectId, userId, role, filters) {
    // Faculty must be assigned
    if (role === 'faculty') {
        const subject = await subject_model_1.SubjectModel.findOne({ _id: subjectId, facultyIds: new mongoose_1.default.Types.ObjectId(userId) });
        if (!subject)
            throw new AppError_1.AuthorizationError('Not assigned to this subject');
    }
    const matchStage = { subjectId: new mongoose_1.default.Types.ObjectId(subjectId) };
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
        attendance_model_1.AttendanceRecordModel.aggregate([...pipeline, { $count: 'total' }]),
        attendance_model_1.AttendanceRecordModel.aggregate([
            ...pipeline,
            { $skip: (filters.page - 1) * filters.limit },
            { $limit: filters.limit },
        ]),
    ]);
    const total = countResult[0]?.total ?? 0;
    return { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
}
exports.getSubjectAttendance = getSubjectAttendance;
async function getStudentAttendanceHistory(studentId, requesterId, requesterRole, filters) {
    if (requesterRole === 'student' && studentId !== requesterId) {
        throw new AppError_1.AuthorizationError('Cannot view another student\'s attendance');
    }
    const query = { studentId: new mongoose_1.default.Types.ObjectId(studentId) };
    if (filters.subjectId)
        query.subjectId = new mongoose_1.default.Types.ObjectId(filters.subjectId);
    if (filters.month && filters.year) {
        const start = new Date(filters.year, filters.month - 1, 1);
        const end = new Date(filters.year, filters.month, 0, 23, 59, 59);
        query.date = { $gte: start, $lte: end };
    }
    const skip = (filters.page - 1) * filters.limit;
    const [data, total] = await Promise.all([
        attendance_model_1.AttendanceRecordModel.find(query).sort({ date: -1 }).skip(skip).limit(filters.limit),
        attendance_model_1.AttendanceRecordModel.countDocuments(query),
    ]);
    return { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
}
exports.getStudentAttendanceHistory = getStudentAttendanceHistory;
