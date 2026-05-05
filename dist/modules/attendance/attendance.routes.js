"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const attendance_controller_1 = require("./attendance.controller");
const router = (0, express_1.Router)();
// Mark attendance — faculty only
router.post('/', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['faculty', 'admin']), attendance_controller_1.markAttendanceHandler);
// Edit a record — faculty only
router.put('/:id', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['faculty', 'admin']), attendance_controller_1.editAttendanceHandler);
// Lock a session — faculty only
router.post('/lock', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['faculty', 'admin']), attendance_controller_1.lockSessionHandler);
// Get percentage for a student in a subject
router.get('/student/:studentId/subject/:subjectId/percentage', (0, auth_middleware_1.authenticate)(), attendance_controller_1.getPercentageHandler);
// Get subject-wise attendance (faculty/admin)
router.get('/subject/:subjectId', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['faculty', 'admin']), attendance_controller_1.getSubjectAttendanceHandler);
// Get student attendance history
router.get('/student/:studentId', (0, auth_middleware_1.authenticate)(), attendance_controller_1.getStudentHistoryHandler);
exports.default = router;
