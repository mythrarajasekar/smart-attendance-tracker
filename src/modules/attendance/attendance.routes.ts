import { Router } from 'express';
import { authenticate, authorize } from '../auth/auth.middleware';
import {
  markAttendanceHandler, editAttendanceHandler, lockSessionHandler,
  getPercentageHandler, getSubjectAttendanceHandler, getStudentHistoryHandler,
} from './attendance.controller';

const router = Router();

// Mark attendance — faculty only
router.post('/', authenticate(), authorize(['faculty', 'admin']), markAttendanceHandler);

// Edit a record — faculty only
router.put('/:id', authenticate(), authorize(['faculty', 'admin']), editAttendanceHandler);

// Lock a session — faculty only
router.post('/lock', authenticate(), authorize(['faculty', 'admin']), lockSessionHandler);

// Get percentage for a student in a subject
router.get('/student/:studentId/subject/:subjectId/percentage', authenticate(), getPercentageHandler);

// Get subject-wise attendance (faculty/admin)
router.get('/subject/:subjectId', authenticate(), authorize(['faculty', 'admin']), getSubjectAttendanceHandler);

// Get student attendance history
router.get('/student/:studentId', authenticate(), getStudentHistoryHandler);

export default router;
