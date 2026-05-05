"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectSearchSchema = exports.enrollStudentsSchema = exports.assignFacultySchema = exports.updateSubjectSchema = exports.createSubjectSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const academicYearSchema = joi_1.default.string()
    .pattern(/^\d{4}-\d{4}$/)
    .required()
    .messages({ 'string.pattern.base': 'Academic year must be in format YYYY-YYYY (e.g. 2024-2025)' });
// Accepts: "1st Sem", "2nd Sem", "3rd Sem", "4th Sem", "5th Sem", "6th Sem"
const semesterSchema = joi_1.default.string()
    .max(20)
    .required();
exports.createSubjectSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(200).trim().required(),
    code: joi_1.default.string().max(20).uppercase().required(),
    department: joi_1.default.string().max(100).trim().required(),
    semester: semesterSchema,
    academicYear: academicYearSchema,
    credits: joi_1.default.number().integer().min(1).max(10).required(),
    capacity: joi_1.default.number().integer().min(1).allow(null).default(null),
});
exports.updateSubjectSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(200).trim().optional(),
    department: joi_1.default.string().max(100).trim().optional(),
    semester: joi_1.default.string().max(20).optional(),
    credits: joi_1.default.number().integer().min(1).max(10).optional(),
    capacity: joi_1.default.number().integer().min(1).allow(null).optional(),
}).min(1);
exports.assignFacultySchema = joi_1.default.object({
    facultyId: joi_1.default.string().hex().length(24).required()
        .messages({ 'string.length': 'facultyId must be a valid MongoDB ObjectId' }),
});
exports.enrollStudentsSchema = joi_1.default.object({
    studentIds: joi_1.default.array()
        .items(joi_1.default.string().hex().length(24))
        .min(1)
        .max(1000)
        .required(),
});
exports.subjectSearchSchema = joi_1.default.object({
    department: joi_1.default.string().max(100).optional(),
    semester: joi_1.default.string().max(20).optional(),
    academicYear: joi_1.default.string().pattern(/^\d{4}-\d{4}$/).optional(),
    isActive: joi_1.default.boolean().truthy('true').falsy('false').default(true),
    search: joi_1.default.string().max(100).trim().optional(),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    sortBy: joi_1.default.string().valid('name', 'code', 'createdAt').default('createdAt'),
    sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc'),
});
