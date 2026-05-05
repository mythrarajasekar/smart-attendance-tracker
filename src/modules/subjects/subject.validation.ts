import Joi from 'joi';

const academicYearSchema = Joi.string()
  .pattern(/^\d{4}-\d{4}$/)
  .required()
  .messages({ 'string.pattern.base': 'Academic year must be in format YYYY-YYYY (e.g. 2024-2025)' });

// Accepts: "1st Sem", "2nd Sem", "3rd Sem", "4th Sem", "5th Sem", "6th Sem"
const semesterSchema = Joi.string()
  .max(20)
  .required();

export const createSubjectSchema = Joi.object({
  name: Joi.string().min(2).max(200).trim().required(),
  code: Joi.string().max(20).uppercase().required(),
  department: Joi.string().max(100).trim().required(),
  semester: semesterSchema,
  academicYear: academicYearSchema,
  credits: Joi.number().integer().min(1).max(10).required(),
  capacity: Joi.number().integer().min(1).allow(null).default(null),
});

export const updateSubjectSchema = Joi.object({
  name: Joi.string().min(2).max(200).trim().optional(),
  department: Joi.string().max(100).trim().optional(),
  semester: Joi.string().max(20).optional(),
  credits: Joi.number().integer().min(1).max(10).optional(),
  capacity: Joi.number().integer().min(1).allow(null).optional(),
}).min(1);

export const assignFacultySchema = Joi.object({
  facultyId: Joi.string().hex().length(24).required()
    .messages({ 'string.length': 'facultyId must be a valid MongoDB ObjectId' }),
});

export const enrollStudentsSchema = Joi.object({
  studentIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .max(1000)
    .required(),
});

export const subjectSearchSchema = Joi.object({
  department: Joi.string().max(100).optional(),
  semester: Joi.string().max(20).optional(),
  academicYear: Joi.string().pattern(/^\d{4}-\d{4}$/).optional(),
  isActive: Joi.boolean().truthy('true').falsy('false').default(true),
  search: Joi.string().max(100).trim().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('name', 'code', 'createdAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
