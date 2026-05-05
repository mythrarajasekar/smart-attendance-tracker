/**
 * Property-Based Tests — Unit 1: Authentication & RBAC
 * Framework: fast-check (PBT-02, PBT-03, PBT-07, PBT-08, PBT-09 — Partial mode)
 *
 * Properties tested:
 *   PBT-AUTH-01: JWT round-trip (encode → decode returns identical payload)
 *   PBT-AUTH-02: bcrypt hash is always different from plaintext
 *   PBT-AUTH-03: bcrypt.compare returns true iff password matches
 *   PBT-AUTH-04: Blacklisted token is always rejected
 *   PBT-AUTH-05: Expired token is always rejected
 */
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

jest.mock('../../../shared/utils/redisClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
  },
}));

import redisClient from '../../../shared/utils/redisClient';
import { verifyAccessToken } from '../auth.service';
import { AuthenticationError } from '../../../shared/errors/AppError';

const mockRedis = redisClient as jest.Mocked<typeof redisClient>;

const JWT_SECRET = 'test-secret-32-bytes-minimum-length!!';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-bytes-min!!';
});

// ─── Domain Generators ───────────────────────────────────────────────────────

const userIdArb = fc.uuid();
const emailArb = fc.emailAddress();
const roleArb = fc.constantFrom('student', 'faculty', 'admin') as fc.Arbitrary<'student' | 'faculty' | 'admin'>;
const passwordArb = fc.string({ minLength: 8, maxLength: 64 }).filter(s => /[A-Z]/.test(s) && /[0-9]/.test(s));

// ─── PBT-AUTH-01: JWT Round-Trip ─────────────────────────────────────────────

describe('PBT-AUTH-01: JWT encode → decode round-trip', () => {
  it('decoded payload matches original for all valid inputs', () => {
    fc.assert(
      fc.asyncProperty(userIdArb, emailArb, roleArb, async (userId, email, role) => {
        const jti = 'test-jti';
        const token = jwt.sign(
          { sub: userId, email, role },
          JWT_SECRET,
          { expiresIn: '15m', jwtid: jti }
        );

        mockRedis.get.mockResolvedValue(null); // not blacklisted

        const payload = await verifyAccessToken(token);

        expect(payload.sub).toBe(userId);
        expect(payload.email).toBe(email);
        expect(payload.role).toBe(role);
        expect(payload.jti).toBe(jti);
      }),
      { numRuns: 50 }
    );
  });
});

// ─── PBT-AUTH-02: bcrypt hash is always different from plaintext ──────────────

describe('PBT-AUTH-02: bcrypt hash invariant', () => {
  it('hash is never equal to the original password', () => {
    fc.assert(
      fc.asyncProperty(passwordArb, async (password) => {
        const hash = await bcrypt.hash(password, 10);
        expect(hash).not.toBe(password);
        expect(hash.startsWith('$2b$')).toBe(true); // bcrypt format
      }),
      { numRuns: 20 }
    );
  });

  it('same password produces different hashes (salted)', () => {
    fc.assert(
      fc.asyncProperty(passwordArb, async (password) => {
        const hash1 = await bcrypt.hash(password, 10);
        const hash2 = await bcrypt.hash(password, 10);
        expect(hash1).not.toBe(hash2); // different salts
      }),
      { numRuns: 20 }
    );
  });
});

// ─── PBT-AUTH-03: bcrypt.compare invariant ───────────────────────────────────

describe('PBT-AUTH-03: bcrypt compare invariant', () => {
  it('compare returns true iff password matches original', () => {
    fc.assert(
      fc.asyncProperty(passwordArb, passwordArb, async (password, otherPassword) => {
        const hash = await bcrypt.hash(password, 10);

        const matchSame = await bcrypt.compare(password, hash);
        expect(matchSame).toBe(true);

        if (password !== otherPassword) {
          const matchOther = await bcrypt.compare(otherPassword, hash);
          expect(matchOther).toBe(false);
        }
      }),
      { numRuns: 20 }
    );
  });
});

// ─── PBT-AUTH-04: Blacklisted token always rejected ──────────────────────────

describe('PBT-AUTH-04: Blacklisted token invariant', () => {
  it('blacklisted token is always rejected regardless of other valid fields', () => {
    fc.assert(
      fc.asyncProperty(userIdArb, emailArb, roleArb, async (userId, email, role) => {
        const token = jwt.sign(
          { sub: userId, email, role },
          JWT_SECRET,
          { expiresIn: '15m', jwtid: 'blacklisted-jti' }
        );

        mockRedis.get.mockResolvedValue('1'); // blacklisted

        await expect(verifyAccessToken(token)).rejects.toThrow(AuthenticationError);
      }),
      { numRuns: 30 }
    );
  });
});

// ─── PBT-AUTH-05: Expired token always rejected ──────────────────────────────

describe('PBT-AUTH-05: Expired token invariant', () => {
  it('token with exp in the past is always rejected', () => {
    fc.assert(
      fc.asyncProperty(userIdArb, emailArb, roleArb, async (userId, email, role) => {
        const token = jwt.sign(
          { sub: userId, email, role },
          JWT_SECRET,
          { expiresIn: '-1s' } // already expired
        );

        await expect(verifyAccessToken(token)).rejects.toThrow(AuthenticationError);
      }),
      { numRuns: 30 }
    );
  });
});
