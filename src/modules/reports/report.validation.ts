import Joi from 'joi';

export const reportQuerySchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  format: Joi.string().valid('pdf', 'excel', 'csv').default('pdf'),
  threshold: Joi.number().min(1).max(100).default(75),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(100),
});
