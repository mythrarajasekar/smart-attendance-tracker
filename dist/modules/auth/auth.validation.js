"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = exports.logoutSchema = exports.refreshSchema = exports.loginSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().max(255).required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
    }),
    password: joi_1.default.string().min(1).max(128).required().messages({
        'any.required': 'Password is required',
    }),
});
exports.refreshSchema = joi_1.default.object({
    refreshToken: joi_1.default.string().required().messages({
        'any.required': 'Refresh token is required',
    }),
});
exports.logoutSchema = joi_1.default.object({
    refreshToken: joi_1.default.string().required().messages({
        'any.required': 'Refresh token is required',
    }),
});
/**
 * Validates a request body against a Joi schema.
 * Returns { value, error } — caller decides how to handle.
 */
function validateBody(schema, body) {
    const { value, error } = schema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
    });
    return { value, error };
}
exports.validateBody = validateBody;
