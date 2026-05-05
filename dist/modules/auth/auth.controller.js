"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutHandler = exports.refreshHandler = exports.loginHandler = void 0;
const authService = __importStar(require("./auth.service"));
const auth_validation_1 = require("./auth.validation");
const AppError_1 = require("../../shared/errors/AppError");
/**
 * POST /api/v1/auth/login
 * Validates credentials and returns a JWT token pair.
 */
async function loginHandler(req, res, next) {
    try {
        const { value, error } = (0, auth_validation_1.validateBody)(auth_validation_1.loginSchema, req.body);
        if (error) {
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        }
        const result = await authService.login(value.email, value.password, req.correlationId);
        res.status(200).json({
            success: true,
            data: {
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                expiresIn: result.tokens.expiresIn,
                user: result.user,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
exports.loginHandler = loginHandler;
/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token and returns a new token pair.
 */
async function refreshHandler(req, res, next) {
    try {
        const { value, error } = (0, auth_validation_1.validateBody)(auth_validation_1.refreshSchema, req.body);
        if (error) {
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        }
        const tokens = await authService.refreshTokens(value.refreshToken, req.correlationId);
        res.status(200).json({
            success: true,
            data: tokens,
        });
    }
    catch (err) {
        next(err);
    }
}
exports.refreshHandler = refreshHandler;
/**
 * POST /api/v1/auth/logout
 * Blacklists the access token and deletes the refresh token.
 * Requires authentication (authenticate middleware must run first).
 */
async function logoutHandler(req, res, next) {
    try {
        const { value, error } = (0, auth_validation_1.validateBody)(auth_validation_1.logoutSchema, req.body);
        if (error) {
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        }
        const accessToken = req.headers.authorization.slice(7);
        await authService.logout(req.user.userId, accessToken, value.refreshToken, req.correlationId);
        res.status(200).json({
            success: true,
            data: { message: 'Logged out successfully' },
        });
    }
    catch (err) {
        next(err);
    }
}
exports.logoutHandler = logoutHandler;
