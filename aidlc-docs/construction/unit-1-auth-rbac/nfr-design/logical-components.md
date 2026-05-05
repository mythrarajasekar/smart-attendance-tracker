# Logical Components — Unit 1: Authentication & RBAC

## Component Map

```
+------------------------------------------------------------------+
|                    AUTH UNIT LOGICAL COMPONENTS                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Rate Limiter]          [Security Headers]    [CORS Policy]     |
|  express-rate-limit      helmet.js             cors middleware   |
|  + Redis store           (global middleware)   (origin whitelist)|
|  (per-endpoint limits)                                           |
|                                                                  |
|  [Request Logger]        [Correlation ID]      [Error Handler]   |
|  Morgan + Winston        UUID injector         Global catch-all  |
|  (structured JSON)       (x-correlation-id)    (no stack traces) |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Auth Controller]                                               |
|  POST /login, /logout, /refresh                                  |
|  → validates input (Joi)                                         |
|  → calls AuthService                                             |
|  → formats response                                              |
|                                                                  |
|  [Auth Middleware]                                               |
|  authenticate()  → JWT verify + Redis blacklist check            |
|  authorize(roles[]) → role check                                 |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Auth Service]                                                  |
|  login() / logout() / refreshTokens()                           |
|  generateAccessToken() / generateRefreshToken()                  |
|  verifyAccessToken()                                             |
|  incrementFailedAttempts() / isAccountLocked()                   |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Redis Client]              [User Model]                        |
|  ioredis singleton           Mongoose schema                     |
|  Connection pool             passwordHash: select false          |
|  Retry strategy              Indexes: email, rollNumber          |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [JWT Utils]                 [Bcrypt Utils]                      |
|  sign() / verify()           hash() / compare()                  |
|  decode() (no verify)        cost: 12                            |
|  jti: uuidv4()               timing-safe                         |
|                                                                  |
+------------------------------------------------------------------+
```

## Logical Component Specifications

### Rate Limiter Component

```
Type:       Express middleware (applied at router level)
Library:    express-rate-limit 7.x + rate-limit-redis 4.x
Instances:
  globalLimiter:  100 req/min/IP — applied to all routes
  loginLimiter:   10 req/min/IP  — applied to POST /auth/login only
  refreshLimiter: 30 req/min/IP  — applied to POST /auth/refresh only
Failure mode: FAIL OPEN (if Redis unavailable, allow request + log warning)
Headers:    RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset (standard headers)
```

### Correlation ID Component

```
Type:       Express middleware (applied first in chain)
Logic:      Read x-correlation-id header from request
            If present: use it (for distributed tracing)
            If absent: generate UUID v4
            Attach to req.correlationId
            Set x-correlation-id response header
            Attach to Winston logger context for all subsequent log calls
```

### Auth Middleware Component

```
Type:       Express middleware factory
authenticate():
  1. Extract Bearer token from Authorization header
  2. Verify JWT signature (JWT_SECRET)
  3. Check exp claim
  4. GET blacklist:{jti} from Redis
  5. Attach req.user = { userId, email, role }
  6. next()

authorize(roles[]):
  1. Check req.user exists
  2. Check req.user.role in roles[]
  3. next() or throw AuthorizationError
```

### JWT Utils Component

```
Type:       Pure utility module (no side effects)
Functions:
  signAccessToken(payload): string
    → jwt.sign(payload, JWT_SECRET, { expiresIn: '15m', jwtid: uuidv4() })

  signRefreshToken(userId): string
    → jwt.sign({ sub: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d', jwtid: uuidv4() })

  verifyAccessToken(token): AccessTokenPayload
    → jwt.verify(token, JWT_SECRET) — throws on invalid/expired

  verifyRefreshToken(token): RefreshTokenPayload
    → jwt.verify(token, JWT_REFRESH_SECRET)

  decodeToken(token): JwtPayload | null
    → jwt.decode(token) — no verification (used for blacklisting on logout)
```

### Redis Client Component

```
Type:       Singleton module
Library:    ioredis 5.x
Config:
  host:     REDIS_HOST env var
  port:     REDIS_PORT env var (default 6379)
  password: REDIS_PASSWORD env var
  tls:      enabled in production
  retryStrategy: exponential backoff (100ms, 200ms, 400ms, then fail)
  maxRetriesPerRequest: 3
  connectTimeout: 5000ms

Exported:   Single ioredis instance, shared across all services
Health check: PING command on startup — fail fast if Redis unreachable
```

### Global Error Handler Component

```
Type:       Express error middleware (4-argument: err, req, res, next)
Logic:
  1. Log full error with stack trace + correlationId (Winston)
  2. If err instanceof AppError:
       return res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message }, correlationId })
  3. If err instanceof ValidationError (Joi):
       return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.details }, correlationId })
  4. Otherwise (unknown error):
       return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, correlationId })
  5. NEVER expose stack traces, internal paths, or DB details in response
```
