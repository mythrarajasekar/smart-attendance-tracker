import Joi from 'joi';

const passwordSchema = Joi.string()
  .min(6)
  .max(128)
  .required()
  .messages({ 'string.min': 'Password must be at least 6 characters' });

const phoneSchema = Joi.string().max(20).allow(null, '').optional();

export const createStudentSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: passwordSchema,
  name: Joi.string().min(2).max(100).trim().required(),
  rollNumber: Joi.string().max(20).required(),
  department: Joi.string().max(100).trim().required(),
  yearSemester: Joi.string().max(30).trim().required(),
  academicYear: Joi.string().pattern(/^\d{4}-\d{4}$/).required()
    .messages({ 'string.pattern.base': 'Academic year must be YYYY-YYYY (e.g. 2024-2025)' }),
  phone: phoneSchema,
  parentContact: Joi.string().max(200).allow(null, '').optional(),
});

export const createFacultySchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: passwordSchema,
  name: Joi.string().min(2).max(100).trim().required(),
  employeeId: Joi.string().max(20).required(),
  department: Joi.string().max(100).trim().required(),
  designation: Joi.string().max(100).trim().allow(null, '').optional(),
  phone: phoneSchema,
});

export const createAdminSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: passwordSchema,
  name: Joi.string().min(2).max(100).trim().required(),
});

export const updateStudentProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  phone: phoneSchema,
  parentContact: Joi.string().max(200).allow(null, '').optional(),
  yearSemester: Joi.string().max(30).trim().optional(),
  profilePhotoUrl: Joi.string().uri({ scheme: ['https'] }).max(1000).allow(null).optional(),
  profilePhotoKey: Joi.string().max(500).allow(null).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

export const updateFacultyProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  phone: phoneSchema,
  designation: Joi.string().max(100).trim().allow(null, '').optional(),
  profilePhotoUrl: Joi.string().uri({ scheme: ['https'] }).max(1000).allow(null).optional(),
  profilePhotoKey: Joi.string().max(500).allow(null).optional(),
}).min(1);

export const updateAdminProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  phone: phoneSchema,
}).min(1);

export const adminUpdateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  email: Joi.string().email().max(255).optional(),
  department: Joi.string().max(100).trim().optional(),
  yearSemester: Joi.string().max(30).trim().optional(),
  academicYear: Joi.string().pattern(/^\d{4}-\d{4}$/).optional(),
  designation: Joi.string().max(100).trim().allow(null, '').optional(),
  phone: phoneSchema,
  isActive: Joi.boolean().truthy('true').falsy('false').optional(),
}).min(1);

// isActive accepts string 'true'/'false' from query params as well as boolean
export const userSearchSchema = Joi.object({
  role: Joi.string().valid('student', 'faculty', 'admin').optional(),
  department: Joi.string().max(100).optional(),
  academicYear: Joi.string().pattern(/^\d{4}-\d{4}$/).optional(),
  isActive: Joi.boolean().truthy('true').falsy('false').default(true),
  search: Joi.string().max(100).trim().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('name', 'email', 'createdAt', 'rollNumber').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
