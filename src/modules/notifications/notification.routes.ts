import { Router } from 'express';
import { authenticate, authorize } from '../auth/auth.middleware';
import {
  getNotificationsHandler, markAsReadHandler,
  markAllAsReadHandler, deleteNotificationHandler,
} from './notification.controller';

const router = Router();

// All notification routes are student-only (own notifications)
router.get('/', authenticate(), authorize(['student']), getNotificationsHandler);
router.put('/read-all', authenticate(), authorize(['student']), markAllAsReadHandler);
router.put('/:id/read', authenticate(), authorize(['student']), markAsReadHandler);
router.delete('/:id', authenticate(), authorize(['student']), deleteNotificationHandler);

export default router;
