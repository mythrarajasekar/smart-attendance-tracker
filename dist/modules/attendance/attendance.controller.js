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
exports.getStudentHistoryHandler = exports.getSubjectAttendanceHandler = exports.getPercentageHandler = exports.lockSessionHandler = exports.editAttendanceHandler = exports.markAttendanceHandler = void 0;
const attendanceService = __importStar(require("./attendance.service"));
const attendance_validation_1 = require("./attendance.validation");
const AppError_1 = require("../../shared/errors/AppError");
async function markAttendanceHandler(req, res, next) {
    try {
        const { value, error } = attendance_validation_1.markAttendanceSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const result = await attendanceService.markAttendance(req.user.userId, value);
        res.status(201).json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
exports.markAttendanceHandler = markAttendanceHandler;
async function editAttendanceHandler(req, res, next) {
    try {
        const { value, error } = attendance_validation_1.editAttendanceSchema.validate(req.body, { abortEarly: false });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const record = await attendanceService.editAttendanceRecord(req.params.id, req.user.userId, value);
        res.status(200).json({ success: true, data: record });
    }
    catch (err) {
        next(err);
    }
}
exports.editAttendanceHandler = editAttendanceHandler;
async function lockSessionHandler(req, res, next) {
    try {
        const { value, error } = attendance_validation_1.lockSessionSchema.validate(req.body, { abortEarly: false });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        await attendanceService.lockSession(value.sessionId, req.user.userId);
        res.status(200).json({ success: true, data: { message: 'Session locked successfully' } });
    }
    catch (err) {
        next(err);
    }
}
exports.lockSessionHandler = lockSessionHandler;
async function getPercentageHandler(req, res, next) {
    try {
        const { studentId, subjectId } = req.params;
        const pct = await attendanceService.calculateAndCachePercentage(studentId, subjectId);
        res.status(200).json({ success: true, data: pct });
    }
    catch (err) {
        next(err);
    }
}
exports.getPercentageHandler = getPercentageHandler;
async function getSubjectAttendanceHandler(req, res, next) {
    try {
        const { value, error } = attendance_validation_1.attendanceQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const result = await attendanceService.getSubjectAttendance(req.params.subjectId, req.user.userId, req.user.role, value);
        res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    }
    catch (err) {
        next(err);
    }
}
exports.getSubjectAttendanceHandler = getSubjectAttendanceHandler;
async function getStudentHistoryHandler(req, res, next) {
    try {
        const { value, error } = attendance_validation_1.attendanceQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const result = await attendanceService.getStudentAttendanceHistory(req.params.studentId, req.user.userId, req.user.role, value);
        res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    }
    catch (err) {
        next(err);
    }
}
exports.getStudentHistoryHandler = getStudentHistoryHandler;
