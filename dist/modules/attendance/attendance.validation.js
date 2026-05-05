"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceQuerySchema = exports.lockSessionSchema = exports.editAttendanceSchema = exports.markAttendanceSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const objectIdSchema = joi_1.default.string().hex().length(24).required();
exports.markAttendanceSchema = joi_1.default.object({
    subjectId: objectIdSchema,
    date: joi_1.default.date().iso().max('now').required()
        .messages({ 'date.max': 'Attendance date cannot be in the future' }),
    sessionLabel: joi_1.default.string().max(50).trim().default('Default'),
    records: joi_1.default.array()
        .items(joi_1.default.object({
        studentId: objectIdSchema,
        status: joi_1.default.string().valid('present', 'absent').required(),
    }))
        .min(1)
        .max(500)
        .required(),
});
exports.editAttendanceSchema = joi_1.default.object({
    status: joi_1.default.string().valid('present', 'absent').required(),
    editReason: joi_1.default.string().min(3).max(500).trim().required()
        .messages({ 'any.required': 'Edit reason is required when modifying attendance' }),
});
exports.lockSessionSchema = joi_1.default.object({
    sessionId: joi_1.default.string().required(),
});
exports.attendanceQuerySchema = joi_1.default.object({
    subjectId: joi_1.default.string().hex().length(24).optional(),
    studentId: joi_1.default.string().hex().length(24).optional(),
    month: joi_1.default.number().integer().min(1).max(12).optional(),
    year: joi_1.default.number().integer().min(2000).max(2100).optional(),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
});
