"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = exports.AccountLockedError = exports.BusinessRuleError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    code;
    message;
    statusCode;
    details;
    constructor(code, message, statusCode, details) {
        super(message);
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
        this.details = details;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super('VALIDATION_ERROR', message, 400, details);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
        super(code, message, 401);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super('FORBIDDEN', message, 403);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource) {
        super('NOT_FOUND', `${resource} not found`, 404);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message, code = 'CONFLICT') {
        super(code, message, 409);
    }
}
exports.ConflictError = ConflictError;
class BusinessRuleError extends AppError {
    constructor(message, code = 'BUSINESS_RULE_VIOLATION', details) {
        super(code, message, 422, details);
    }
}
exports.BusinessRuleError = BusinessRuleError;
class AccountLockedError extends AppError {
    retryAfter;
    constructor(retryAfter) {
        super('ACCOUNT_LOCKED', 'Account temporarily locked due to too many failed attempts', 423);
        this.retryAfter = retryAfter;
    }
}
exports.AccountLockedError = AccountLockedError;
class ServiceUnavailableError extends AppError {
    constructor(message = 'Service temporarily unavailable') {
        super('SERVICE_UNAVAILABLE', message, 503);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
