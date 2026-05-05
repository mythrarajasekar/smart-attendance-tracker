"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../auth/auth.middleware");
const subject_controller_1 = require("./subject.controller");
const AppError_1 = require("../../shared/errors/AppError");
const router = (0, express_1.Router)();
// CSV upload: memory storage, 1 MB, text/csv only
const csvUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 1 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        }
        else {
            cb(new AppError_1.ValidationError('Only CSV files are allowed for bulk enrollment'));
        }
    },
});
// ─── Subject CRUD (Admin only for mutations) ──────────────────────────────────
router.post('/', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), subject_controller_1.createSubjectHandler);
router.get('/', (0, auth_middleware_1.authenticate)(), subject_controller_1.listSubjectsHandler); // role-scoped in service
router.get('/:id', (0, auth_middleware_1.authenticate)(), subject_controller_1.getSubjectByIdHandler); // role-scoped in service
router.put('/:id', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), subject_controller_1.updateSubjectHandler);
router.delete('/:id', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), subject_controller_1.deactivateSubjectHandler);
// ─── Faculty assignment (Admin only) ─────────────────────────────────────────
router.post('/:id/faculty', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), subject_controller_1.assignFacultyHandler);
router.delete('/:id/faculty/:facultyId', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), subject_controller_1.removeFacultyHandler);
// ─── Student enrollment (Admin only for mutations) ────────────────────────────
router.post('/:id/students', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), subject_controller_1.enrollStudentsHandler);
router.post('/:id/students/bulk', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), csvUpload.single('file'), subject_controller_1.bulkEnrollCSVHandler);
router.delete('/:id/students/:studentId', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin']), subject_controller_1.unenrollStudentHandler);
router.get('/:id/students', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['admin', 'faculty']), subject_controller_1.getEnrolledStudentsHandler);
exports.default = router;
