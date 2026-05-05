# NFR Requirements — Unit 1: Authentication & RBAC

## Performance Requirements

| ID | Requirement | Target | Measurement |
|---|---|---|---|
| NFR-AUTH-PERF-01 | Login endpoint response time | p95 < 200ms | Measured at API gateway, excludes network latency |
| NFR-AUTH-PERF-02 | Token refresh response time | p95 < 100ms | Redis read + JWT sign — no DB query |
| NFR-AUTH-PERF-03 | Auth middleware overhead per request | < 10ms | Redis blacklist check + JWT verify |
| NFR-AUTH-PERF-04 | Logout response time | p95 < 50ms | Two Redis writes, no DB query |
| NFR-AUTH-PERF-05 | bcrypt cost factor | 12 | Balances security vs login latency (~100-200ms on modern hardware) |

**Rationale for bcrypt cost 12**: At cost 12, bcrypt takes ~100-200ms per hash on a modern server. This is acceptable for login (user-initiated, infrequent) and provides strong brute-force resistance. Cost factor is configurable via `BCRYPT_ROUNDS` env var.

## Scalability Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-AUTH-SCALE-01 | Concurrent authenticated users | 1,000 simultaneous active sessions |
| NFR-AUTH-SCALE-02 | Login requests per second | 50 RPS sustained, 200 RPS burst |
| NFR-AUTH-SCALE-03 | Token refresh requests per second | 200 RPS (higher than login — happens more frequently) |
| NFR-AUTH-SCALE-04 | Horizontal scaling | Auth service must be stateless — all state in Redis |
| NFR-AUTH-SCALE-05 | Redis connection pool | Min 5, Max 20 connections per Node.js instance |

## Availability Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-AUTH-AVAIL-01 | Auth service uptime | 99.9% (< 8.7 hours downtime/year) |
| NFR-AUTH-AVAIL-02 | Redis unavailability behavior | Fail closed — reject all token operations, return 503 |
| NFR-AUTH-AVAIL-03 | Redis connection retry | Exponential backoff, max 3 retries, then fail |
| NFR-AUTH-AVAIL-04 | Graceful shutdown | Drain in-flight requests before shutdown (SIGTERM handler) |

## Security Requirements

| ID | Requirement | Enforcement |
|---|---|---|
| NFR-AUTH-SEC-01 | Brute-force protection | 5 failed attempts → 15-minute lockout (Redis-backed) |
| NFR-AUTH-SEC-02 | Rate limiting on login endpoint | 10 requests per IP per minute (express-rate-limit + Redis store) |
| NFR-AUTH-SEC-03 | Rate limiting on refresh endpoint | 30 requests per IP per minute |
| NFR-AUTH-SEC-04 | Rate limiting globally | 100 requests per IP per minute across all endpoints |
| NFR-AUTH-SEC-05 | JWT secrets minimum entropy | 256 bits (32 bytes) — enforced in deployment docs |
| NFR-AUTH-SEC-06 | Passwords hashed with bcrypt | Cost factor 12 (configurable via BCRYPT_ROUNDS) |
| NFR-AUTH-SEC-07 | No sensitive data in logs | Email logged, password/token never logged |
| NFR-AUTH-SEC-08 | CORS restricted to known origins | Access-Control-Allow-Origin: [configured origins only] |
| NFR-AUTH-SEC-09 | HTTP security headers | helmet.js: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy |
| NFR-AUTH-SEC-10 | Token blacklist on logout | Redis blacklist:{jti} with TTL = remaining token lifetime |
| NFR-AUTH-SEC-11 | Refresh token replay detection | Stored token comparison — mismatch = reject + alert |
| NFR-AUTH-SEC-12 | Account lockout info not leaked | Same error message for invalid credentials and locked accounts |

## Audit Logging Requirements

| ID | Requirement | Log Fields |
|---|---|---|
| NFR-AUTH-AUDIT-01 | Log every login attempt (success + failure) | timestamp, correlationId, email (masked: first 3 chars + ***), result, ip, userAgent |
| NFR-AUTH-AUDIT-02 | Log every logout | timestamp, correlationId, userId, result |
| NFR-AUTH-AUDIT-03 | Log every token refresh | timestamp, correlationId, userId, result |
| NFR-AUTH-AUDIT-04 | Log account lockout events | timestamp, email (masked), ip, attemptCount |
| NFR-AUTH-AUDIT-05 | Log RBAC authorization failures | timestamp, correlationId, userId, role, requiredRoles, endpoint |
| NFR-AUTH-AUDIT-06 | Log format | JSON structured (Winston), includes correlationId on every entry |
| NFR-AUTH-AUDIT-07 | Log retention | Minimum 90 days (SECURITY-14 compliant) |
| NFR-AUTH-AUDIT-08 | Sensitive data in logs | Passwords NEVER logged. Tokens NEVER logged. Email masked. |

## Reliability Requirements

| ID | Requirement |
|---|---|
| NFR-AUTH-REL-01 | All async operations have explicit error handling (try/catch or .catch()) |
| NFR-AUTH-REL-02 | Redis failures fail closed (reject request, return 503) |
| NFR-AUTH-REL-03 | JWT verification failures return 401 (never 500) |
| NFR-AUTH-REL-04 | Global error handler catches all unhandled errors in auth routes |
| NFR-AUTH-REL-05 | No unhandled promise rejections in auth service |
