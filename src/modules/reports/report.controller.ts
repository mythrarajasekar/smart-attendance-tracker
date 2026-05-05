import { Request, Response, NextFunction } from 'express';
import * as reportService from './report.service';
import { reportQuerySchema } from './report.validation';
import { ValidationError } from '../../shared/errors/AppError';

export async function studentReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = reportQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));

    const report = await reportService.generateStudentReport(
      req.user!.userId, req.user!.role, req.params.studentId,
      value.month, value.year, value.format, req.correlationId
    );

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.setHeader('X-Report-Row-Count', String(report.rowCount));
    res.status(200).send(report.buffer);
  } catch (err) { next(err); }
}

export async function subjectReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = reportQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));

    const report = await reportService.generateSubjectReport(
      req.user!.userId, req.user!.role, req.params.subjectId,
      value.month, value.year, value.format, req.correlationId
    );

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.setHeader('X-Report-Row-Count', String(report.rowCount));
    res.status(200).send(report.buffer);
  } catch (err) { next(err); }
}
