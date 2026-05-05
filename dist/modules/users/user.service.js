"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProfilePhoto = exports.deactivateUser = exports.adminUpdateUser = exports.listUsers = exports.getUserById = exports.updateMyProfile = exports.getMyProfile = exports.createUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const sharp_1 = __importDefault(require("sharp"));
const uuid_1 = require("uuid");
const user_model_1 = require("./user.model");
const redisClient_1 = __importDefault(require("../../shared/utils/redisClient"));
const logger_1 = require("../../shared/utils/logger");
const AppError_1 = require("../../shared/errors/AppError");
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const PROFILE_CACHE_TTL = 300; // 5 minutes
const LIST_PROJECTION = '-passwordHash -auditLog -profilePhotoKey -parentContact';
// ─── S3 Client ───────────────────────────────────────────────────────────────
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
});
const S3_BUCKET = process.env.S3_BUCKET;
// ─── Cache helpers ───────────────────────────────────────────────────────────
async function getCachedProfile(userId) {
    try {
        const cached = await redisClient_1.default.get(`profile:${userId}`);
        if (cached)
            return JSON.parse(cached);
    }
    catch { /* fall through */ }
    return null;
}
async function setCachedProfile(userId, profile) {
    try {
        await redisClient_1.default.set(`profile:${userId}`, JSON.stringify(profile), 'EX', PROFILE_CACHE_TTL);
    }
    catch { /* non-critical */ }
}
async function invalidateProfileCache(userId) {
    try {
        await redisClient_1.default.del(`profile:${userId}`);
    }
    catch { /* non-critical */ }
}
// ─── Optimistic concurrency update ──────────────────────────────────────────
async function updateWithConcurrency(userId, updates, auditEntry, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const current = await user_model_1.UserModel.findById(userId).select('+__v');
        if (!current)
            throw new AppError_1.NotFoundError('User');
        const result = await user_model_1.UserModel.findOneAndUpdate({ _id: userId, __v: current.__v }, { $set: updates, $inc: { __v: 1 }, $push: { auditLog: auditEntry } }, { new: true, select: LIST_PROJECTION });
        if (result)
            return result;
        if (attempt < maxRetries - 1)
            await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
    }
    throw new AppError_1.ConflictError('CONCURRENT_MODIFICATION', 'Profile was modified concurrently. Please retry.');
}
// ─── Allowed fields by role ──────────────────────────────────────────────────
const ALLOWED_UPDATE_FIELDS = {
    student: ['name', 'phone', 'parentContact', 'yearSemester', 'profilePhotoUrl', 'profilePhotoKey'],
    faculty: ['name', 'phone', 'designation', 'profilePhotoUrl', 'profilePhotoKey'],
    admin: ['name', 'phone'],
};
// ─── Service functions ───────────────────────────────────────────────────────
async function createUser(data, adminId) {
    const { email, password, role, ...rest } = data;
    // Uniqueness checks
    const existing = await user_model_1.UserModel.findOne({ email: email.toLowerCase() });
    if (existing)
        throw new AppError_1.ConflictError('Email already in use', 'DUPLICATE_EMAIL');
    if (role === 'student' && rest.rollNumber) {
        const dup = await user_model_1.UserModel.findOne({ rollNumber: rest.rollNumber });
        if (dup)
            throw new AppError_1.ConflictError('Roll number already in use', 'DUPLICATE_ROLL_NUMBER');
    }
    if (role === 'faculty' && rest.employeeId) {
        const dup = await user_model_1.UserModel.findOne({ employeeId: rest.employeeId });
        if (dup)
            throw new AppError_1.ConflictError('Employee ID already in use', 'DUPLICATE_EMPLOYEE_ID');
    }
    const passwordHash = await bcrypt_1.default.hash(password, BCRYPT_ROUNDS);
    const auditEntry = {
        changedBy: adminId,
        changedAt: new Date(),
        action: 'created',
        fields: Object.keys(rest),
        previousValues: {},
    };
    const user = await user_model_1.UserModel.create({
        email: email.toLowerCase(),
        passwordHash,
        role,
        ...rest,
        auditLog: [auditEntry],
    });
    logger_1.logger.info('user.created', { adminId, userId: user._id.toString(), role });
    return user;
}
exports.createUser = createUser;
async function getMyProfile(userId) {
    const cached = await getCachedProfile(userId);
    if (cached)
        return cached;
    const user = await user_model_1.UserModel.findById(userId).select(LIST_PROJECTION);
    if (!user)
        throw new AppError_1.NotFoundError('User');
    await setCachedProfile(userId, user);
    return user;
}
exports.getMyProfile = getMyProfile;
async function updateMyProfile(userId, role, updates) {
    const allowed = ALLOWED_UPDATE_FIELDS[role];
    const forbidden = Object.keys(updates).filter(k => !allowed.includes(k));
    if (forbidden.length > 0) {
        throw new AppError_1.BusinessRuleError(`Fields not allowed for ${role}: ${forbidden.join(', ')}`, 'FORBIDDEN_FIELD');
    }
    const current = await user_model_1.UserModel.findById(userId).select(allowed.join(' '));
    if (!current)
        throw new AppError_1.NotFoundError('User');
    const previousValues = {};
    for (const key of Object.keys(updates)) {
        previousValues[key] = current[key];
    }
    const auditEntry = {
        changedBy: userId,
        changedAt: new Date(),
        action: 'updated',
        fields: Object.keys(updates),
        previousValues,
    };
    const updated = await updateWithConcurrency(userId, updates, auditEntry);
    await invalidateProfileCache(userId);
    return updated;
}
exports.updateMyProfile = updateMyProfile;
async function getUserById(userId) {
    const cached = await getCachedProfile(userId);
    if (cached)
        return cached;
    const user = await user_model_1.UserModel.findById(userId).select(LIST_PROJECTION);
    if (!user)
        throw new AppError_1.NotFoundError('User');
    await setCachedProfile(userId, user);
    return user;
}
exports.getUserById = getUserById;
async function listUsers(filters) {
    const query = { isActive: filters.isActive ?? true };
    if (filters.role)
        query.role = filters.role;
    if (filters.department)
        query.department = filters.department;
    if (filters.academicYear)
        query.academicYear = filters.academicYear;
    if (filters.search) {
        query.$text = { $search: filters.search };
    }
    const skip = (filters.page - 1) * filters.limit;
    const sortDir = filters.sortOrder === 'desc' ? -1 : 1;
    const [data, total] = await Promise.all([
        user_model_1.UserModel.find(query)
            .select(LIST_PROJECTION)
            .sort({ [filters.sortBy]: sortDir })
            .skip(skip)
            .limit(filters.limit),
        user_model_1.UserModel.countDocuments(query),
    ]);
    return {
        data,
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
    };
}
exports.listUsers = listUsers;
async function adminUpdateUser(targetUserId, adminId, updates) {
    const current = await user_model_1.UserModel.findById(targetUserId).select('+__v');
    if (!current)
        throw new AppError_1.NotFoundError('User');
    const previousValues = {};
    for (const key of Object.keys(updates)) {
        previousValues[key] = current[key];
    }
    const auditEntry = {
        changedBy: adminId,
        changedAt: new Date(),
        action: 'updated',
        fields: Object.keys(updates),
        previousValues,
    };
    const updated = await updateWithConcurrency(targetUserId, updates, auditEntry);
    await invalidateProfileCache(targetUserId);
    logger_1.logger.info('user.admin_updated', { adminId, targetUserId, fields: Object.keys(updates) });
    return updated;
}
exports.adminUpdateUser = adminUpdateUser;
async function deactivateUser(targetUserId, adminId) {
    if (targetUserId === adminId) {
        throw new AppError_1.BusinessRuleError('Administrators cannot deactivate their own account', 'CANNOT_DEACTIVATE_SELF');
    }
    const user = await user_model_1.UserModel.findById(targetUserId);
    if (!user)
        throw new AppError_1.NotFoundError('User');
    if (!user.isActive)
        throw new AppError_1.BusinessRuleError('User is already inactive', 'USER_ALREADY_INACTIVE');
    await user_model_1.UserModel.findByIdAndUpdate(targetUserId, {
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
        await redisClient_1.default.del(`refresh:${targetUserId}`);
        await redisClient_1.default.set(`blacklist:user:${targetUserId}`, '1', 'EX', 604800);
    }
    catch { /* non-critical */ }
    await invalidateProfileCache(targetUserId);
    logger_1.logger.info('user.deactivated', { adminId, targetUserId });
}
exports.deactivateUser = deactivateUser;
async function uploadProfilePhoto(userId, file) {
    // Process image
    const processed = await (0, sharp_1.default)(file.buffer)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();
    const key = `profiles/${userId}/${(0, uuid_1.v4)()}.webp`;
    // Upload to S3
    await s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: processed,
        ContentType: 'image/webp',
    }));
    // Generate pre-signed URL
    const url = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, new client_s3_1.GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn: 3600 });
    // Get old key before update
    const user = await user_model_1.UserModel.findById(userId).select('+profilePhotoKey');
    const oldKey = user?.profilePhotoKey;
    // Update document
    await user_model_1.UserModel.findByIdAndUpdate(userId, {
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
        s3Client.send(new client_s3_1.DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey }))
            .catch(err => logger_1.logger.warn('Failed to delete old profile photo', { oldKey, err: String(err) }));
    }
    await invalidateProfileCache(userId);
    return url;
}
exports.uploadProfilePhoto = uploadProfilePhoto;
