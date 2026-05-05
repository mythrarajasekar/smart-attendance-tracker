import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { loginSchema, refreshSchema, logoutSchema, validateBody } from './auth.validation';
import { ValidationError } from '../../shared/errors/AppError';

/**
 * POST /api/v1/auth/login
 * Validates credentials and returns a JWT token pair.
 */
export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = validateBody(loginSchema, req.body);
    if (error) {
      return next(new ValidationError('Validation failed', error.details));
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
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token and returns a new token pair.
 */
export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = validateBody(refreshSchema, req.body);
    if (error) {
      return next(new ValidationError('Validation failed', error.details));
    }

    const tokens = await authService.refreshTokens(value.refreshToken, req.correlationId);

    res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Blacklists the access token and deletes the refresh token.
 * Requires authentication (authenticate middleware must run first).
 */
export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { value, error } = validateBody(logoutSchema, req.body);
    if (error) {
      return next(new ValidationError('Validation failed', error.details));
    }

    const accessToken = req.headers.authorization!.slice(7);
    await authService.logout(
      req.user!.userId,
      accessToken,
      value.refreshToken,
      req.correlationId
    );

    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (err) {
    next(err);
  }
}
