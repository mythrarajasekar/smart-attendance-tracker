import { Request, Response, NextFunction } from 'express';
import * as attendanceService from './attendance.service';
import {
  markAttendanceSchema, editAttendanceSchema, lockSessionSchema, attendanceQuerySchema,
} from './attendance.validation';
import { ValidationError } from '../../shared/errors/AppError';

export async function markAttendanceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = markAttendanceSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));
    const result = await attendanceService.markAttendance(req.user!.userId, value);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function editAttendanceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = editAttendanceSchema.validate(req.body, { abortEarly: false });
    if (error) return next(new ValidationError('Validation failed', error.details));
    const record = await attendanceService.editAttendanceRecord(req.params.id, req.user!.userId, value);
    res.status(200).json({ success: true, data: record });
  } catch (err) { next(err); }
}

export async function lockSessionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = lockSessionSchema.validate(req.body, { abortEarly: false });
    if (error) return next(new ValidationError('Validation failed', error.details));
    await attendanceService.lockSession(value.sessionId, req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'Session locked successfully' } });
  } catch (err) { next(err); }
}

export async function getPercentageHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentId, subjectId } = req.params;
    const pct = await attendanceService.calculateAndCachePercentage(studentId, subjectId);
    res.status(200).json({ success: true, data: pct });
  } catch (err) { next(err); }
}

export async function getSubjectAttendanceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = attendanceQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));
    const result = await attendanceService.getSubjectAttendance(
      req.params.subjectId, req.user!.userId, req.user!.role, value
    );
    res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (err) { next(err); }
}

export async function getStudentHistoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = attendanceQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));
    const result = await attendanceService.getStudentAttendanceHistory(
      req.params.studentId, req.user!.userId, req.user!.role, value
    );
    res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (err) { next(err); }
}
