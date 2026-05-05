import { Request, Response, NextFunction } from 'express';
import * as notificationService from './notification.service';
import { notificationQuerySchema } from './notification.validation';
import { ValidationError } from '../../shared/errors/AppError';

export async function getNotificationsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = notificationQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));

    const result = await notificationService.getNotifications(req.user!.userId, value);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: { total: result.total, unreadCount: result.unreadCount, page: result.page, limit: result.limit, totalPages: result.totalPages },
    });
  } catch (err) { next(err); }
}

export async function markAsReadHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notificationService.markAsRead(req.params.id, req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'Notification marked as read' } });
  } catch (err) { next(err); }
}

export async function markAllAsReadHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notificationService.markAllAsRead(req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'All notifications marked as read' } });
  } catch (err) { next(err); }
}

export async function deleteNotificationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notificationService.deleteNotification(req.params.id, req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'Notification deleted' } });
  } catch (err) { next(err); }
}
