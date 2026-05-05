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
exports.getEnrolledStudentsHandler = exports.bulkEnrollCSVHandler = exports.unenrollStudentHandler = exports.enrollStudentsHandler = exports.removeFacultyHandler = exports.assignFacultyHandler = exports.deactivateSubjectHandler = exports.updateSubjectHandler = exports.getSubjectByIdHandler = exports.listSubjectsHandler = exports.createSubjectHandler = void 0;
const subjectService = __importStar(require("./subject.service"));
const subject_validation_1 = require("./subject.validation");
const AppError_1 = require("../../shared/errors/AppError");
async function createSubjectHandler(req, res, next) {
    try {
        const { value, error } = subject_validation_1.createSubjectSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const subject = await subjectService.createSubject(value, req.user.userId);
        res.status(201).json({ success: true, data: subject });
    }
    catch (err) {
        next(err);
    }
}
exports.createSubjectHandler = createSubjectHandler;
async function listSubjectsHandler(req, res, next) {
    try {
        const { value, error } = subject_validation_1.subjectSearchSchema.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const result = await subjectService.listSubjects(req.user.userId, req.user.role, value);
        res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    }
    catch (err) {
        next(err);
    }
}
exports.listSubjectsHandler = listSubjectsHandler;
async function getSubjectByIdHandler(req, res, next) {
    try {
        const subject = await subjectService.getSubjectById(req.params.id, req.user.userId, req.user.role);
        res.status(200).json({ success: true, data: subject });
    }
    catch (err) {
        next(err);
    }
}
exports.getSubjectByIdHandler = getSubjectByIdHandler;
async function updateSubjectHandler(req, res, next) {
    try {
        const { value, error } = subject_validation_1.updateSubjectSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const subject = await subjectService.updateSubject(req.params.id, req.user.userId, value);
        res.status(200).json({ success: true, data: subject });
    }
    catch (err) {
        next(err);
    }
}
exports.updateSubjectHandler = updateSubjectHandler;
async function deactivateSubjectHandler(req, res, next) {
    try {
        await subjectService.deactivateSubject(req.params.id, req.user.userId);
        res.status(200).json({ success: true, data: { message: 'Subject deactivated' } });
    }
    catch (err) {
        next(err);
    }
}
exports.deactivateSubjectHandler = deactivateSubjectHandler;
async function assignFacultyHandler(req, res, next) {
    try {
        const { value, error } = subject_validation_1.assignFacultySchema.validate(req.body, { abortEarly: false });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        await subjectService.assignFaculty(req.params.id, value.facultyId, req.user.userId);
        res.status(200).json({ success: true, data: { message: 'Faculty assigned' } });
    }
    catch (err) {
        next(err);
    }
}
exports.assignFacultyHandler = assignFacultyHandler;
async function removeFacultyHandler(req, res, next) {
    try {
        await subjectService.removeFaculty(req.params.id, req.params.facultyId, req.user.userId);
        res.status(200).json({ success: true, data: { message: 'Faculty removed' } });
    }
    catch (err) {
        next(err);
    }
}
exports.removeFacultyHandler = removeFacultyHandler;
async function enrollStudentsHandler(req, res, next) {
    try {
        const { value, error } = subject_validation_1.enrollStudentsSchema.validate(req.body, { abortEarly: false });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const result = await subjectService.enrollStudents(req.params.id, value.studentIds, req.user.userId);
        res.status(200).json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
exports.enrollStudentsHandler = enrollStudentsHandler;
async function unenrollStudentHandler(req, res, next) {
    try {
        await subjectService.unenrollStudent(req.params.id, req.params.studentId, req.user.userId);
        res.status(200).json({ success: true, data: { message: 'Student unenrolled' } });
    }
    catch (err) {
        next(err);
    }
}
exports.unenrollStudentHandler = unenrollStudentHandler;
async function bulkEnrollCSVHandler(req, res, next) {
    try {
        if (!req.file)
            return next(new AppError_1.ValidationError('No CSV file uploaded'));
        const result = await subjectService.bulkEnrollCSV(req.params.id, req.file.buffer, req.user.userId);
        res.status(200).json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
exports.bulkEnrollCSVHandler = bulkEnrollCSVHandler;
async function getEnrolledStudentsHandler(req, res, next) {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const result = await subjectService.getEnrolledStudents(req.params.id, req.user.userId, req.user.role, { page, limit });
        res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    }
    catch (err) {
        next(err);
    }
}
exports.getEnrolledStudentsHandler = getEnrolledStudentsHandler;
