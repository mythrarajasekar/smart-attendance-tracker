import { Request, Response, NextFunction } from 'express';
import * as subjectService from './subject.service';
import {
  createSubjectSchema, updateSubjectSchema, assignFacultySchema,
  enrollStudentsSchema, subjectSearchSchema,
} from './subject.validation';
import { ValidationError } from '../../shared/errors/AppError';

export async function createSubjectHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = createSubjectSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));
    const subject = await subjectService.createSubject(value, req.user!.userId);
    res.status(201).json({ success: true, data: subject });
  } catch (err) { next(err); }
}

export async function listSubjectsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = subjectSearchSchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));
    const result = await subjectService.listSubjects(req.user!.userId, req.user!.role, value);
    res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (err) { next(err); }
}

export async function getSubjectByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subject = await subjectService.getSubjectById(req.params.id, req.user!.userId, req.user!.role);
    res.status(200).json({ success: true, data: subject });
  } catch (err) { next(err); }
}

export async function updateSubjectHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = updateSubjectSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));
    const subject = await subjectService.updateSubject(req.params.id, req.user!.userId, value);
    res.status(200).json({ success: true, data: subject });
  } catch (err) { next(err); }
}

export async function deactivateSubjectHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await subjectService.deactivateSubject(req.params.id, req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'Subject deactivated' } });
  } catch (err) { next(err); }
}

export async function assignFacultyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = assignFacultySchema.validate(req.body, { abortEarly: false });
    if (error) return next(new ValidationError('Validation failed', error.details));
    await subjectService.assignFaculty(req.params.id, value.facultyId, req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'Faculty assigned' } });
  } catch (err) { next(err); }
}

export async function removeFacultyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await subjectService.removeFaculty(req.params.id, req.params.facultyId, req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'Faculty removed' } });
  } catch (err) { next(err); }
}

export async function enrollStudentsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = enrollStudentsSchema.validate(req.body, { abortEarly: false });
    if (error) return next(new ValidationError('Validation failed', error.details));
    const result = await subjectService.enrollStudents(req.params.id, value.studentIds, req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function unenrollStudentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await subjectService.unenrollStudent(req.params.id, req.params.studentId, req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'Student unenrolled' } });
  } catch (err) { next(err); }
}

export async function bulkEnrollCSVHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) return next(new ValidationError('No CSV file uploaded'));
    const result = await subjectService.bulkEnrollCSV(req.params.id, req.file.buffer, req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getEnrolledStudentsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
    const result = await subjectService.getEnrolledStudents(req.params.id, req.user!.userId, req.user!.role, { page, limit });
    res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (err) { next(err); }
}
