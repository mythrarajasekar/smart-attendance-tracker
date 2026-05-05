"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const auth_service_1 = require("./auth.service");
const AppError_1 = require("../../shared/errors/AppError");
/**
 * Verifies the JWT access token from the Authorization header.
 * Checks the Redis blacklist.
 * Attaches req.user = { userId, email, role } on success.
 * Returns 401 on any failure.
 */
function authenticate() {
    return async (req, _res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError_1.AuthenticationError('No token provided', 'NO_TOKEN'));
        }
        const token = authHeader.slice(7);
        try {
            const payload = await (0, auth_service_1.verifyAccessToken)(token);
            req.user = {
                userId: payload.sub,
                email: payload.email,
                role: payload.role,
            };
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
exports.authenticate = authenticate;
/**
 * Checks that req.user.role is in the allowedRoles array.
 * Must be used after authenticate().
 * Returns 403 if role is not permitted.
 */
function authorize(allowedRoles) {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new AppError_1.AuthenticationError('Authentication required'));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError_1.AuthorizationError('Insufficient permissions'));
        }
        next();
    };
}
exports.authorize = authorize;
