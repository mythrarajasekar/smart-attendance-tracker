import Joi from 'joi';

const objectIdSchema = Joi.string().hex().length(24).required();

export const markAttendanceSchema = Joi.object({
  subjectId: objectIdSchema,
  date: Joi.date().iso().max('now').required()
    .messages({ 'date.max': 'Attendance date cannot be in the future' }),
  sessionLabel: Joi.string().max(50).trim().default('Default'),
  records: Joi.array()
    .items(Joi.object({
      studentId: objectIdSchema,
      status: Joi.string().valid('present', 'absent').required(),
    }))
    .min(1)
    .max(500)
    .required(),
});

export const editAttendanceSchema = Joi.object({
  status: Joi.string().valid('present', 'absent').required(),
  editReason: Joi.string().min(3).max(500).trim().required()
    .messages({ 'any.required': 'Edit reason is required when modifying attendance' }),
});

export const lockSessionSchema = Joi.object({
  sessionId: Joi.string().required(),
});

export const attendanceQuerySchema = Joi.object({
  subjectId: Joi.string().hex().length(24).optional(),
  studentId: Joi.string().hex().length(24).optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2000).max(2100).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
