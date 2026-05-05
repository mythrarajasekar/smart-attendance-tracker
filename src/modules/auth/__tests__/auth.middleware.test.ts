/**
 * Unit Tests — auth.middleware.ts
 */
import { Request, Response, NextFunction } from 'express';

jest.mock('../auth.service', () => ({
  verifyAccessToken: jest.fn(),
}));

import * as authService from '../auth.service';
import { authenticate, authorize } from '../auth.middleware';
import { AuthenticationError, AuthorizationError } from '../../../shared/errors/AppError';

const mockVerify = authService.verifyAccessToken as jest.MockedFunction<typeof authService.verifyAccessToken>;

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    correlationId: 'test-corr',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('authenticate middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-32-bytes-minimum-length!!';
  });

  it('calls next() and sets req.user on valid token', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer valid.token.here' } });
    const next = jest.fn() as NextFunction;

    mockVerify.mockResolvedValue({
      sub: 'user123',
      email: 'test@example.com',
      role: 'student',
      jti: 'jti-1',
      iat: 0,
      exp: 9999999999,
    });

    await authenticate()(req, mockRes(), next);

    expect(req.user).toEqual({ userId: 'user123', email: 'test@example.com', role: 'student' });
    expect(next).toHaveBeenCalledWith(); // called with no args = success
  });

  it('calls next(AuthenticationError) when no Authorization header', async () => {
    const req = mockReq({ headers: {} });
    const next = jest.fn() as NextFunction;

    await authenticate()(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  it('calls next(AuthenticationError) when token is invalid', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer bad.token' } });
    const next = jest.fn() as NextFunction;

    mockVerify.mockRejectedValue(new AuthenticationError('Invalid token'));

    await authenticate()(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });
});

describe('authorize middleware', () => {
  it('calls next() when role is allowed', () => {
    const req = mockReq({ user: { userId: 'u1', email: 'e@e.com', role: 'admin' } } as never);
    const next = jest.fn() as NextFunction;

    authorize(['admin', 'faculty'])(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(AuthorizationError) when role is not allowed', () => {
    const req = mockReq({ user: { userId: 'u1', email: 'e@e.com', role: 'student' } } as never);
    const next = jest.fn() as NextFunction;

    authorize(['admin', 'faculty'])(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('calls next(AuthenticationError) when req.user is missing', () => {
    const req = mockReq();
    const next = jest.fn() as NextFunction;

    authorize(['admin'])(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });
});
