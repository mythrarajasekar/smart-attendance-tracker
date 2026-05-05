"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnrolledStudents = exports.bulkEnrollCSV = exports.unenrollStudent = exports.enrollStudents = exports.removeFaculty = exports.assignFaculty = exports.deactivateSubject = exports.updateSubject = exports.getSubjectById = exports.listSubjects = exports.createSubject = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const csv_parse_1 = require("csv-parse");
const stream_1 = require("stream");
const subject_model_1 = require("./subject.model");
const user_model_1 = require("../users/user.model");
const redisClient_1 = __importDefault(require("../../shared/utils/redisClient"));
const logger_1 = require("../../shared/utils/logger");
const AppError_1 = require("../../shared/errors/AppError");
const SUBJECT_DETAIL_TTL = 300; // 5 minutes
const SUBJECT_LIST_TTL = 60; // 1 minute
const SUBJECT_PROJECTION = '-auditLog';
// ─── Cache helpers ───────────────────────────────────────────────────────────
function hashQuery(query) {
    return crypto_1.default.createHash('md5')
        .update(JSON.stringify(query, Object.keys(query).sort()))
        .digest('hex');
}
async function getSubjectCache(subjectId) {
    try {
        const cached = await redisClient_1.default.get(`subjects:${subjectId}`);
        if (cached)
            return JSON.parse(cached);
    }
    catch { /* fall through */ }
    return null;
}
async function setSubjectCache(subjectId, subject) {
    try {
        await redisClient_1.default.set(`subjects:${subjectId}`, JSON.stringify(subject), 'EX', SUBJECT_DETAIL_TTL);
    }
    catch { /* non-critical */ }
}
async function invalidateSubjectCache(subjectId) {
    try {
        await redisClient_1.default.del(`subjects:${subjectId}`);
    }
    catch { /* non-critical */ }
}
async function invalidateListCache() {
    try {
        const keys = await redisClient_1.default.keys('subjects:list:*');
        if (keys.length > 0)
            await redisClient_1.default.del(...keys);
    }
    catch { /* non-critical */ }
}
// ─── Service functions ───────────────────────────────────────────────────────
async function createSubject(data, adminId) {
    const code = data.code.toUpperCase();
    const academicYear = data.academicYear;
    const existing = await subject_model_1.SubjectModel.findOne({ code, academicYear });
    if (existing)
        throw new AppError_1.ConflictError(`Subject code ${code} already exists for ${academicYear}`, 'DUPLICATE_SUBJECT_CODE');
    const subject = await subject_model_1.SubjectModel.create({
        ...data,
        code,
        isActive: true,
        facultyIds: [],
        studentIds: [],
        createdBy: adminId,
        auditLog: [{ changedBy: adminId, changedAt: new Date(), action: 'created', details: {} }],
    });
    await invalidateListCache();
    logger_1.logger.info('subject.created', { adminId, subjectId: subject._id.toString(), code });
    return subject;
}
exports.createSubject = createSubject;
async function listSubjects(userId, role, filters) {
    const query = { isActive: filters.isActive ?? true };
    // Role scoping
    if (role === 'faculty')
        query.facultyIds = userId;
    if (role === 'student')
        query.studentIds = userId;
    if (filters.department)
        query.department = filters.department;
    if (filters.semester)
        query.semester = filters.semester;
    if (filters.academicYear)
        query.academicYear = filters.academicYear;
    if (filters.search)
        query.$text = { $search: filters.search };
    const cacheKey = `subjects:list:${hashQuery({ ...filters, userId: role !== 'admin' ? userId : 'admin' })}`;
    try {
        const cached = await redisClient_1.default.get(cacheKey);
        if (cached)
            return JSON.parse(cached);
    }
    catch { /* fall through */ }
    const skip = (filters.page - 1) * filters.limit;
    const sortDir = filters.sortOrder === 'desc' ? -1 : 1;
    const [data, total] = await Promise.all([
        subject_model_1.SubjectModel.find(query)
            .select(SUBJECT_PROJECTION)
            .sort({ [filters.sortBy]: sortDir })
            .skip(skip)
            .limit(filters.limit),
        subject_model_1.SubjectModel.countDocuments(query),
    ]);
    const result = { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
    try {
        await redisClient_1.default.set(cacheKey, JSON.stringify(result), 'EX', SUBJECT_LIST_TTL);
    }
    catch { /* non-critical */ }
    return result;
}
exports.listSubjects = listSubjects;
async function getSubjectById(subjectId, userId, role) {
    const cached = await getSubjectCache(subjectId);
    if (cached) {
        validateSubjectAccess(cached, userId, role);
        return cached;
    }
    const subject = await subject_model_1.SubjectModel.findById(subjectId).select(SUBJECT_PROJECTION);
    if (!subject)
        throw new AppError_1.NotFoundError('Subject');
    validateSubjectAccess(subject, userId, role);
    await setSubjectCache(subjectId, subject);
    return subject;
}
exports.getSubjectById = getSubjectById;
function validateSubjectAccess(subject, userId, role) {
    if (role === 'faculty') {
        const isFaculty = subject.facultyIds.some(id => id.toString() === userId);
        if (!isFaculty)
            throw new AppError_1.AuthorizationError('You are not assigned to this subject');
    }
    if (role === 'student') {
        const isEnrolled = subject.studentIds.some(id => id.toString() === userId);
        if (!isEnrolled)
            throw new AppError_1.AuthorizationError('You are not enrolled in this subject');
    }
}
async function updateSubject(subjectId, adminId, updates) {
    const subject = await subject_model_1.SubjectModel.findById(subjectId);
    if (!subject)
        throw new AppError_1.NotFoundError('Subject');
    const updated = await subject_model_1.SubjectModel.findByIdAndUpdate(subjectId, {
        $set: updates,
        $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'updated', details: { fields: Object.keys(updates) } } },
    }, { new: true, select: SUBJECT_PROJECTION });
    await invalidateSubjectCache(subjectId);
    await invalidateListCache();
    return updated;
}
exports.updateSubject = updateSubject;
async function deactivateSubject(subjectId, adminId) {
    const subject = await subject_model_1.SubjectModel.findById(subjectId);
    if (!subject)
        throw new AppError_1.NotFoundError('Subject');
    if (!subject.isActive)
        throw new AppError_1.BusinessRuleError('Subject is already inactive', 'SUBJECT_ALREADY_INACTIVE');
    await subject_model_1.SubjectModel.findByIdAndUpdate(subjectId, {
        $set: { isActive: false },
        $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'deactivated', details: {} } },
    });
    await invalidateSubjectCache(subjectId);
    await invalidateListCache();
    logger_1.logger.info('subject.deactivated', { adminId, subjectId });
}
exports.deactivateSubject = deactivateSubject;
async function assignFaculty(subjectId, facultyId, adminId) {
    const [subject, faculty] = await Promise.all([
        subject_model_1.SubjectModel.findById(subjectId),
        user_model_1.UserModel.findById(facultyId).select('role isActive'),
    ]);
    if (!subject || !subject.isActive)
        throw new AppError_1.NotFoundError('Subject');
    if (!faculty || faculty.role !== 'faculty')
        throw new AppError_1.BusinessRuleError('User is not a faculty member', 'NOT_A_FACULTY_USER');
    await subject_model_1.SubjectModel.findByIdAndUpdate(subjectId, {
        $addToSet: { facultyIds: facultyId },
        $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'faculty_assigned', details: { facultyId } } },
    });
    await invalidateSubjectCache(subjectId);
}
exports.assignFaculty = assignFaculty;
async function removeFaculty(subjectId, facultyId, adminId) {
    const subject = await subject_model_1.SubjectModel.findById(subjectId);
    if (!subject)
        throw new AppError_1.NotFoundError('Subject');
    await subject_model_1.SubjectModel.findByIdAndUpdate(subjectId, {
        $pull: { facultyIds: facultyId },
        $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'faculty_removed', details: { facultyId } } },
    });
    await invalidateSubjectCache(subjectId);
}
exports.removeFaculty = removeFaculty;
async function enrollStudents(subjectId, studentIds, adminId) {
    const subject = await subject_model_1.SubjectModel.findById(subjectId);
    if (!subject)
        throw new AppError_1.NotFoundError('Subject');
    if (!subject.isActive)
        throw new AppError_1.BusinessRuleError('Cannot enroll in inactive subject', 'SUBJECT_INACTIVE');
    const result = { enrolled: 0, alreadyEnrolled: 0, capacityExceeded: 0, notFound: 0, failed: [] };
    // Validate student IDs exist and have student role
    const students = await user_model_1.UserModel.find({ _id: { $in: studentIds }, role: 'student' }).select('_id');
    const validStudentIds = new Set(students.map(s => s._id.toString()));
    const alreadyEnrolledIds = new Set(subject.studentIds.map(id => id.toString()));
    const toEnroll = [];
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
        await subject_model_1.SubjectModel.bulkWrite([{
                updateOne: {
                    filter: { _id: new mongoose_1.default.Types.ObjectId(subjectId) },
                    update: {
                        $addToSet: { studentIds: { $each: toEnroll.map(id => new mongoose_1.default.Types.ObjectId(id)) } },
                        $push: { auditLog: { changedBy: new mongoose_1.default.Types.ObjectId(adminId), changedAt: new Date(), action: 'student_enrolled', details: { count: toEnroll.length } } },
                    },
                },
            }]);
        result.enrolled = toEnroll.length;
    }
    await invalidateSubjectCache(subjectId);
    return result;
}
exports.enrollStudents = enrollStudents;
async function unenrollStudent(subjectId, studentId, adminId) {
    const subject = await subject_model_1.SubjectModel.findById(subjectId);
    if (!subject)
        throw new AppError_1.NotFoundError('Subject');
    await subject_model_1.SubjectModel.findByIdAndUpdate(subjectId, {
        $pull: { studentIds: studentId },
        $push: { auditLog: { changedBy: adminId, changedAt: new Date(), action: 'student_unenrolled', details: { studentId } } },
    });
    await invalidateSubjectCache(subjectId);
}
exports.unenrollStudent = unenrollStudent;
async function bulkEnrollCSV(subjectId, csvBuffer, adminId) {
    // Parse CSV
    const rollNumbers = await parseEnrollmentCSV(csvBuffer);
    // Batch lookup by rollNumber
    const students = await user_model_1.UserModel.find({ rollNumber: { $in: rollNumbers }, role: 'student' }).select('_id rollNumber');
    const rollToId = new Map(students.map(s => [s.rollNumber, s._id.toString()]));
    const studentIds = [];
    const parseErrors = [];
    rollNumbers.forEach((rn, idx) => {
        const sid = rollToId.get(rn);
        if (sid) {
            studentIds.push(sid);
        }
        else {
            parseErrors.push({ row: idx + 2, reason: `Roll number ${rn} not found` }); // +2: header + 1-based
        }
    });
    const enrollResult = await enrollStudents(subjectId, studentIds, adminId);
    return { ...enrollResult, parseErrors };
}
exports.bulkEnrollCSV = bulkEnrollCSV;
async function parseEnrollmentCSV(buffer) {
    return new Promise((resolve, reject) => {
        const rollNumbers = [];
        let rowCount = 0;
        const parser = (0, csv_parse_1.parse)({ columns: true, skip_empty_lines: true, trim: true });
        parser.on('readable', () => {
            let record;
            while ((record = parser.read()) !== null) {
                rowCount++;
                if (rowCount > 1000) {
                    parser.destroy();
                    reject(new AppError_1.BusinessRuleError('CSV exceeds 1000 row limit', 'CSV_TOO_LARGE'));
                    return;
                }
                if (!record.rollNumber) {
                    parser.destroy();
                    reject(new AppError_1.ValidationError('CSV must have a rollNumber column'));
                    return;
                }
                rollNumbers.push(record.rollNumber.trim());
            }
        });
        parser.on('error', reject);
        parser.on('end', () => resolve([...new Set(rollNumbers)]));
        stream_1.Readable.from(buffer).pipe(parser);
    });
}
async function getEnrolledStudents(subjectId, userId, role, pagination) {
    const subject = await subject_model_1.SubjectModel.findById(subjectId).select('facultyIds studentIds isActive');
    if (!subject)
        throw new AppError_1.NotFoundError('Subject');
    // Faculty must be assigned to this subject
    if (role === 'faculty') {
        const isFaculty = subject.facultyIds.some(id => id.toString() === userId);
        if (!isFaculty)
            throw new AppError_1.AuthorizationError('You are not assigned to this subject');
    }
    const total = subject.studentIds.length;
    const skip = (pagination.page - 1) * pagination.limit;
    const studentIdSlice = subject.studentIds.slice(skip, skip + pagination.limit);
    const students = await user_model_1.UserModel.find({ _id: { $in: studentIdSlice } })
        .select('-passwordHash -auditLog -profilePhotoKey -parentContact');
    return {
        data: students,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
    };
}
exports.getEnrolledStudents = getEnrolledStudents;
