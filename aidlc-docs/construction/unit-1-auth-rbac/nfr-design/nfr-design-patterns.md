# NFR Design Patterns — Unit 1: Authentication & RBAC

## 1. Redis Caching Strategy

### Token Storage Pattern

```
Pattern: Write-through with TTL auto-expiry

Refresh Token Store:
  SET refresh:{userId} {token} EX 604800
  → Written on: login, token refresh
  → Deleted on: logout, token rotation (DEL before SET new)
  → Auto-expires: after 7 days

Blacklist Store:
  SET blacklist:{jti} 1 EX {remaining_seconds}
  → Written on: logout
  → Auto-expires: when original token would have expired
  → Read on: every authenticated request (authMiddleware)

Brute-Force Counters:
  INCR attempts:{email} + EXPIRE 900 (on first increment)
  SET lock:{email} 1 EX 900
  → Written on: failed login
  → Deleted on: successful login (DEL attempts:{email})
  → Auto-expires: 15 minutes

Settings Cache:
  SET settings:global {json} EX 300
  → Written on: settings update
  → Read on: every alert threshold check
  → Auto-expires: 5 minutes (stale-while-revalidate acceptable)
```

### Redis Connection Pool Configuration

```typescript
const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === 'production' ? {} : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000), // exponential backoff, max 3s
  lazyConnect: false,
  enableReadyCheck: true,
  connectTimeout: 5000,
});
```

### Redis Failure Handling (Fail-Closed Pattern)

```typescript
// Auth operations: FAIL CLOSED
// If Redis is unavailable, reject the request
try {
  await redisClient.set(`refresh:${userId}`, token, 'EX', 604800);
} catch (err) {
  logger.error('Redis unavailable during token storage', { correlationId, err });
  throw new ServiceUnavailableError('Authentication service temporarily unavailable');
}

// Rate limiter: FAIL OPEN (with logging)
// If Redis is unavailable, allow the request but log the degradation
```

---

## 2. Horizontal Scaling Strategy

### Stateless Auth Service Design

```
All session state lives in Redis (external) — not in Node.js process memory.
This means any number of Node.js instances can handle any request.

Node.js Instance 1  ─┐
Node.js Instance 2  ─┼──► Redis Cluster ◄── Shared token state
Node.js Instance N  ─┘

Load Balancer distributes requests round-robin.
No sticky sessions required.
```

### Redis Cluster for High Availability

```
Production Redis topology:
  Primary node (writes)
  2x Replica nodes (reads)
  Redis Sentinel for automatic failover

OR: AWS ElastiCache (Redis) with Multi-AZ replication
OR: Azure Cache for Redis with geo-replication
```

### Node.js Clustering

```
PM2 cluster mode: 1 process per CPU core
OR: Docker containers behind ALB (preferred for cloud deployment)

Each container:
  - Stateless (no in-memory session state)
  - Connects to shared Redis cluster
  - Connects to shared MongoDB Atlas cluster
```

---

## 3. Token Encryption Strategy

### Access Token (JWT HS256)

```
Header:  { alg: 'HS256', typ: 'JWT' }
Payload: { sub, email, role, jti, iat, exp }
Signature: HMAC-SHA256(base64(header) + '.' + base64(payload), JWT_SECRET)

JWT_SECRET requirements:
  - Minimum 32 bytes (256 bits) of cryptographic randomness
  - Generated with: openssl rand -base64 32
  - Stored in: AWS Secrets Manager / Azure Key Vault
  - Rotated: annually or on suspected compromise
```

### Refresh Token (JWT HS256, separate secret)

```
JWT_REFRESH_SECRET: separate secret from JWT_SECRET
  - Allows independent rotation of refresh token signing key
  - Minimum 32 bytes entropy
  - Stored in: secrets manager (separate from access token secret)
```

### Transport Security

```
All tokens transmitted over HTTPS only (TLS 1.2+)
HSTS header enforced: max-age=31536000; includeSubDomains
Tokens never transmitted in URL query parameters
```

---

## 4. Fail-Safe Authentication Design

### Defense-in-Depth Layers

```
Layer 1: Rate Limiting (Nginx + express-rate-limit)
  → Blocks volumetric attacks before reaching application

Layer 2: Account Lockout (Redis brute-force protection)
  → Blocks targeted credential stuffing per account

Layer 3: JWT Signature Verification (jsonwebtoken)
  → Rejects tampered or forged tokens

Layer 4: Token Expiry Check (JWT exp claim)
  → Rejects expired tokens even if signature is valid

Layer 5: Redis Blacklist Check (authMiddleware)
  → Rejects logged-out tokens even if not yet expired

Layer 6: RBAC Authorization (authorize middleware)
  → Rejects valid tokens with insufficient role

Layer 7: Object-Level Authorization (service layer)
  → Rejects valid tokens accessing other users' data
```

### Circuit Breaker for Redis (Conceptual)

```
State: CLOSED (normal) → OPEN (Redis down) → HALF-OPEN (testing recovery)

CLOSED: All Redis operations proceed normally
OPEN:   Auth operations return 503 immediately (fail fast, no timeout wait)
        Triggered after 3 consecutive Redis failures within 10 seconds
HALF-OPEN: Allow 1 test request; if succeeds → CLOSED; if fails → OPEN

Implementation: Use ioredis built-in retry + application-level error counter
```

### Graceful Degradation Matrix

| Failure | Behavior | User Impact |
|---|---|---|
| Redis down | Reject all auth operations (503) | Cannot login/refresh — fail safe |
| MongoDB down | Reject login (503), allow token-based requests | Cannot login, existing sessions work |
| Email service down | Log error, continue (non-blocking) | No alert emails, in-app notifications still work |
| JWT_SECRET missing | App fails to start (startup validation) | Deployment fails, not runtime failure |

---

## 5. Security Pattern Implementation

### HTTP Security Headers (helmet.js)

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // allow inline styles for React
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

### Rate Limiting Configuration

```typescript
// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ client: redisClient }),
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
});

// Login-specific rate limiter (stricter)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  store: new RedisStore({ client: redisClient }),
  keyGenerator: (req) => req.ip,  // per IP
});

// Refresh-specific rate limiter
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  store: new RedisStore({ client: redisClient }),
});
```

### Structured Audit Logging Pattern

```typescript
// Every auth event logged with this structure
logger.info('auth.login.success', {
  correlationId: req.correlationId,
  event: 'LOGIN_SUCCESS',
  userId: user._id.toString(),
  email: maskEmail(user.email),  // first 3 chars + ***@domain
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString(),
});

logger.warn('auth.login.failed', {
  correlationId: req.correlationId,
  event: 'LOGIN_FAILED',
  email: maskEmail(email),
  reason: 'INVALID_CREDENTIALS',
  ip: req.ip,
  attemptCount: currentAttempts,
  timestamp: new Date().toISOString(),
});
```
