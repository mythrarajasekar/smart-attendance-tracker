import { Router } from 'express';
import { authenticate, authorize } from '../auth/auth.middleware';
import { studentReportHandler, subjectReportHandler } from './report.controller';

const router = Router();

// Student monthly report — student (own) or admin
router.get('/student/:studentId/monthly', authenticate(), studentReportHandler);

// Subject monthly report — faculty (assigned) or admin
router.get('/subject/:subjectId/monthly', authenticate(), authorize(['faculty', 'admin']), subjectReportHandler);

export default router;
