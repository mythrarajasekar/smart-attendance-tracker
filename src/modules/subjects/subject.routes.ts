import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../auth/auth.middleware';
import {
  createSubjectHandler, listSubjectsHandler, getSubjectByIdHandler,
  updateSubjectHandler, deactivateSubjectHandler,
  assignFacultyHandler, removeFacultyHandler,
  enrollStudentsHandler, unenrollStudentHandler,
  bulkEnrollCSVHandler, getEnrolledStudentsHandler,
} from './subject.controller';
import { ValidationError } from '../../shared/errors/AppError';

const router = Router();

// CSV upload: memory storage, 1 MB, text/csv only
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only CSV files are allowed for bulk enrollment'));
    }
  },
});

// ─── Subject CRUD (Admin only for mutations) ──────────────────────────────────
router.post('/', authenticate(), authorize(['admin']), createSubjectHandler);
router.get('/', authenticate(), listSubjectsHandler);                          // role-scoped in service
router.get('/:id', authenticate(), getSubjectByIdHandler);                     // role-scoped in service
router.put('/:id', authenticate(), authorize(['admin']), updateSubjectHandler);
router.delete('/:id', authenticate(), authorize(['admin']), deactivateSubjectHandler);

// ─── Faculty assignment (Admin only) ─────────────────────────────────────────
router.post('/:id/faculty', authenticate(), authorize(['admin']), assignFacultyHandler);
router.delete('/:id/faculty/:facultyId', authenticate(), authorize(['admin']), removeFacultyHandler);

// ─── Student enrollment (Admin only for mutations) ────────────────────────────
router.post('/:id/students', authenticate(), authorize(['admin']), enrollStudentsHandler);
router.post('/:id/students/bulk', authenticate(), authorize(['admin']), csvUpload.single('file'), bulkEnrollCSVHandler);
router.delete('/:id/students/:studentId', authenticate(), authorize(['admin']), unenrollStudentHandler);
router.get('/:id/students', authenticate(), authorize(['admin', 'faculty']), getEnrolledStudentsHandler);

export default router;
