"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSearchSchema = exports.adminUpdateUserSchema = exports.updateAdminProfileSchema = exports.updateFacultyProfileSchema = exports.updateStudentProfileSchema = exports.createAdminSchema = exports.createFacultySchema = exports.createStudentSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const passwordSchema = joi_1.default.string()
    .min(6)
    .max(128)
    .required()
    .messages({ 'string.min': 'Password must be at least 6 characters' });
const phoneSchema = joi_1.default.string().max(20).allow(null, '').optional();
exports.createStudentSchema = joi_1.default.object({
    email: joi_1.default.string().email().max(255).required(),
    password: passwordSchema,
    name: joi_1.default.string().min(2).max(100).trim().required(),
    rollNumber: joi_1.default.string().max(20).required(),
    department: joi_1.default.string().max(100).trim().required(),
    yearSemester: joi_1.default.string().max(30).trim().required(),
    academicYear: joi_1.default.string().pattern(/^\d{4}-\d{4}$/).required()
        .messages({ 'string.pattern.base': 'Academic year must be YYYY-YYYY (e.g. 2024-2025)' }),
    phone: phoneSchema,
    parentContact: joi_1.default.string().max(200).allow(null, '').optional(),
});
exports.createFacultySchema = joi_1.default.object({
    email: joi_1.default.string().email().max(255).required(),
    password: passwordSchema,
    name: joi_1.default.string().min(2).max(100).trim().required(),
    employeeId: joi_1.default.string().max(20).required(),
    department: joi_1.default.string().max(100).trim().required(),
    designation: joi_1.default.string().max(100).trim().allow(null, '').optional(),
    phone: phoneSchema,
});
exports.createAdminSchema = joi_1.default.object({
    email: joi_1.default.string().email().max(255).required(),
    password: passwordSchema,
    name: joi_1.default.string().min(2).max(100).trim().required(),
});
exports.updateStudentProfileSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).trim().optional(),
    phone: phoneSchema,
    parentContact: joi_1.default.string().max(200).allow(null, '').optional(),
    yearSemester: joi_1.default.string().max(30).trim().optional(),
    profilePhotoUrl: joi_1.default.string().uri({ scheme: ['https'] }).max(1000).allow(null).optional(),
    profilePhotoKey: joi_1.default.string().max(500).allow(null).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });
exports.updateFacultyProfileSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).trim().optional(),
    phone: phoneSchema,
    designation: joi_1.default.string().max(100).trim().allow(null, '').optional(),
    profilePhotoUrl: joi_1.default.string().uri({ scheme: ['https'] }).max(1000).allow(null).optional(),
    profilePhotoKey: joi_1.default.string().max(500).allow(null).optional(),
}).min(1);
exports.updateAdminProfileSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).trim().optional(),
    phone: phoneSchema,
}).min(1);
exports.adminUpdateUserSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).trim().optional(),
    email: joi_1.default.string().email().max(255).optional(),
    department: joi_1.default.string().max(100).trim().optional(),
    yearSemester: joi_1.default.string().max(30).trim().optional(),
    academicYear: joi_1.default.string().pattern(/^\d{4}-\d{4}$/).optional(),
    designation: joi_1.default.string().max(100).trim().allow(null, '').optional(),
    phone: phoneSchema,
    isActive: joi_1.default.boolean().truthy('true').falsy('false').optional(),
}).min(1);
// isActive accepts string 'true'/'false' from query params as well as boolean
exports.userSearchSchema = joi_1.default.object({
    role: joi_1.default.string().valid('student', 'faculty', 'admin').optional(),
    department: joi_1.default.string().max(100).optional(),
    academicYear: joi_1.default.string().pattern(/^\d{4}-\d{4}$/).optional(),
    isActive: joi_1.default.boolean().truthy('true').falsy('false').default(true),
    search: joi_1.default.string().max(100).trim().optional(),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    sortBy: joi_1.default.string().valid('name', 'email', 'createdAt', 'rollNumber').default('createdAt'),
    sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc'),
});
