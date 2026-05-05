"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateUserHandler = exports.adminUpdateUserHandler = exports.listUsersHandler = exports.getUserByIdHandler = exports.createUserHandler = exports.uploadPhotoHandler = exports.updateMyProfileHandler = exports.getMyProfileHandler = void 0;
const userService = __importStar(require("./user.service"));
const user_validation_1 = require("./user.validation");
const AppError_1 = require("../../shared/errors/AppError");
function getCreateSchema(role) {
    if (role === 'student')
        return user_validation_1.createStudentSchema;
    if (role === 'faculty')
        return user_validation_1.createFacultySchema;
    return user_validation_1.createAdminSchema;
}
function getUpdateSchema(role) {
    if (role === 'student')
        return user_validation_1.updateStudentProfileSchema;
    if (role === 'faculty')
        return user_validation_1.updateFacultyProfileSchema;
    return user_validation_1.updateAdminProfileSchema;
}
async function getMyProfileHandler(req, res, next) {
    try {
        const profile = await userService.getMyProfile(req.user.userId);
        res.status(200).json({ success: true, data: profile });
    }
    catch (err) {
        next(err);
    }
}
exports.getMyProfileHandler = getMyProfileHandler;
async function updateMyProfileHandler(req, res, next) {
    try {
        const schema = getUpdateSchema(req.user.role);
        const { value, error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const updated = await userService.updateMyProfile(req.user.userId, req.user.role, value);
        res.status(200).json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
}
exports.updateMyProfileHandler = updateMyProfileHandler;
async function uploadPhotoHandler(req, res, next) {
    try {
        if (!req.file)
            return next(new AppError_1.ValidationError('No file uploaded'));
        const url = await userService.uploadProfilePhoto(req.user.userId, req.file);
        res.status(200).json({ success: true, data: { profilePhotoUrl: url } });
    }
    catch (err) {
        next(err);
    }
}
exports.uploadPhotoHandler = uploadPhotoHandler;
async function createUserHandler(req, res, next) {
    try {
        const role = req.body.role;
        if (!['student', 'faculty', 'admin'].includes(role)) {
            return next(new AppError_1.ValidationError('Invalid role', [{ message: 'role must be student, faculty, or admin' }]));
        }
        const schema = getCreateSchema(role);
        const { value, error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const user = await userService.createUser({ ...value, role }, req.user.userId);
        res.status(201).json({ success: true, data: user });
    }
    catch (err) {
        next(err);
    }
}
exports.createUserHandler = createUserHandler;
async function getUserByIdHandler(req, res, next) {
    try {
        const user = await userService.getUserById(req.params.id);
        res.status(200).json({ success: true, data: user });
    }
    catch (err) {
        next(err);
    }
}
exports.getUserByIdHandler = getUserByIdHandler;
async function listUsersHandler(req, res, next) {
    try {
        const { value, error } = user_validation_1.userSearchSchema.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const result = await userService.listUsers(value);
        res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    }
    catch (err) {
        next(err);
    }
}
exports.listUsersHandler = listUsersHandler;
async function adminUpdateUserHandler(req, res, next) {
    try {
        const { value, error } = user_validation_1.adminUpdateUserSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const updated = await userService.adminUpdateUser(req.params.id, req.user.userId, value);
        res.status(200).json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
}
exports.adminUpdateUserHandler = adminUpdateUserHandler;
async function deactivateUserHandler(req, res, next) {
    try {
        await userService.deactivateUser(req.params.id, req.user.userId);
        res.status(200).json({ success: true, data: { message: 'User deactivated successfully' } });
    }
    catch (err) {
        next(err);
    }
}
exports.deactivateUserHandler = deactivateUserHandler;
