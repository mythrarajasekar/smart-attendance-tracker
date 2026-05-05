import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string().email().max(255).required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(1).max(128).required().messages({
    'any.required': 'Password is required',
  }),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

/**
 * Validates a request body against a Joi schema.
 * Returns { value, error } — caller decides how to handle.
 */
export function validateBody<T>(schema: Joi.ObjectSchema<T>, body: unknown): { value: T; error?: Joi.ValidationError } {
  const { value, error } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
  return { value, error };
}
