import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './auth.service';
import { UserRole } from './auth.model';
import { AuthenticationError, AuthorizationError } from '../../shared/errors/AppError';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Verifies the JWT access token from the Authorization header.
 * Checks the Redis blacklist.
 * Attaches req.user = { userId, email, role } on success.
 * Returns 401 on any failure.
 */
export function authenticate() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AuthenticationError('No token provided', 'NO_TOKEN'));
    }

    const token = authHeader.slice(7);
    try {
      const payload = await verifyAccessToken(token);
      req.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Checks that req.user.role is in the allowedRoles array.
 * Must be used after authenticate().
 * Returns 403 if role is not permitted.
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    next();
  };
}
