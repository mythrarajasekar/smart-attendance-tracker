import { Request, Response, NextFunction } from 'express';
import * as userService from './user.service';
import {
  createStudentSchema,
  createFacultySchema,
  createAdminSchema,
  updateStudentProfileSchema,
  updateFacultyProfileSchema,
  updateAdminProfileSchema,
  adminUpdateUserSchema,
  userSearchSchema,
} from './user.validation';
import { ValidationError } from '../../shared/errors/AppError';

function getCreateSchema(role: string) {
  if (role === 'student') return createStudentSchema;
  if (role === 'faculty') return createFacultySchema;
  return createAdminSchema;
}

function getUpdateSchema(role: string) {
  if (role === 'student') return updateStudentProfileSchema;
  if (role === 'faculty') return updateFacultyProfileSchema;
  return updateAdminProfileSchema;
}

export async function getMyProfileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await userService.getMyProfile(req.user!.userId);
    res.status(200).json({ success: true, data: profile });
  } catch (err) { next(err); }
}

export async function updateMyProfileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const schema = getUpdateSchema(req.user!.role);
    const { value, error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));

    const updated = await userService.updateMyProfile(req.user!.userId, req.user!.role, value);
    res.status(200).json({ success: true, data: updated });
  } catch (err) { next(err); }
}

export async function uploadPhotoHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) return next(new ValidationError('No file uploaded'));
    const url = await userService.uploadProfilePhoto(req.user!.userId, req.file);
    res.status(200).json({ success: true, data: { profilePhotoUrl: url } });
  } catch (err) { next(err); }
}

export async function createUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.body.role;
    if (!['student', 'faculty', 'admin'].includes(role)) {
      return next(new ValidationError('Invalid role', [{ message: 'role must be student, faculty, or admin' }]));
    }
    const schema = getCreateSchema(role);
    const { value, error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));

    const user = await userService.createUser({ ...value, role }, req.user!.userId);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function getUserByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUserById(req.params.id);
    res.status(200).json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function listUsersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = userSearchSchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));

    const result = await userService.listUsers(value);
    res.status(200).json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (err) { next(err); }
}

export async function adminUpdateUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = adminUpdateUserSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new ValidationError('Validation failed', error.details));

    const updated = await userService.adminUpdateUser(req.params.id, req.user!.userId, value);
    res.status(200).json({ success: true, data: updated });
  } catch (err) { next(err); }
}

export async function deactivateUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await userService.deactivateUser(req.params.id, req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'User deactivated successfully' } });
  } catch (err) { next(err); }
}
