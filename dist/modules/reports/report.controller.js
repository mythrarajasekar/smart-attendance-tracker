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
exports.subjectReportHandler = exports.studentReportHandler = void 0;
const reportService = __importStar(require("./report.service"));
const report_validation_1 = require("./report.validation");
const AppError_1 = require("../../shared/errors/AppError");
async function studentReportHandler(req, res, next) {
    try {
        const { value, error } = report_validation_1.reportQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const report = await reportService.generateStudentReport(req.user.userId, req.user.role, req.params.studentId, value.month, value.year, value.format, req.correlationId);
        res.setHeader('Content-Type', report.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
        res.setHeader('X-Report-Row-Count', String(report.rowCount));
        res.status(200).send(report.buffer);
    }
    catch (err) {
        next(err);
    }
}
exports.studentReportHandler = studentReportHandler;
async function subjectReportHandler(req, res, next) {
    try {
        const { value, error } = report_validation_1.reportQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const report = await reportService.generateSubjectReport(req.user.userId, req.user.role, req.params.subjectId, value.month, value.year, value.format, req.correlationId);
        res.setHeader('Content-Type', report.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
        res.setHeader('X-Report-Row-Count', String(report.rowCount));
        res.status(200).send(report.buffer);
    }
    catch (err) {
        next(err);
    }
}
exports.subjectReportHandler = subjectReportHandler;
