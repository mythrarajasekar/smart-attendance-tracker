"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const AppError_1 = require("../errors/AppError");
const logger_1 = require("../utils/logger");
/**
 * Global Express error handler.
 * - Logs full error details with correlation ID (never exposed to client)
 * - Returns generic error messages in production (SECURITY-09 compliant)
 * - Handles AppError subclasses with appropriate status codes
 */
function globalErrorHandler(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    const correlationId = req.correlationId || 'unknown';
    // Log full error details internally
    logger_1.logger.error('Unhandled error', {
        correlationId,
        error: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });
    if (err instanceof AppError_1.AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(err.details ? { details: err.details } : {}),
            },
            correlationId,
        });
        return;
    }
    // Unknown error — return generic 500 (never expose internals)
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        },
        correlationId,
    });
}
exports.globalErrorHandler = globalErrorHandler;
