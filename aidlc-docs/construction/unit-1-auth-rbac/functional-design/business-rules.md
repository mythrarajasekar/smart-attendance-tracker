# Business Rules — Unit 1: Authentication & RBAC

## Authentication Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-AUTH-01 | Access tokens expire after exactly 15 minutes | JWT exp claim + middleware verification |
| BR-AUTH-02 | Refresh tokens expire after exactly 7 days | JWT exp claim + Redis TTL |
| BR-AUTH-03 | Refresh tokens are single-use — each use rotates to a new token | DEL old key before SET new key in Redis |
| BR-AUTH-04 | On logout, access token is blacklisted for its remaining lifetime | Redis blacklist:{jti} with TTL = remaining seconds |
| BR-AUTH-05 | On logout, refresh token is deleted from Redis | DEL refresh:{userId} |
| BR-AUTH-06 | After 5 consecutive failed login attempts, account is locked for 15 minutes | Redis lock:{email} with EX 900 |
| BR-AUTH-07 | Successful login resets the failed attempt counter | DEL attempts:{email} |
| BR-AUTH-08 | Locked account returns HTTP 423 with retryAfter seconds | TTL lock:{email} returned in response |
| BR-AUTH-09 | Invalid credentials and deactivated accounts return the same error message (no info leak) | Same error code: INVALID_CREDENTIALS |
| BR-AUTH-10 | All routes require authentication except POST /auth/login | authMiddleware applied globally, login route excluded |
| BR-AUTH-11 | JWT secrets must be loaded from environment variables, never hardcoded | process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET |
| BR-AUTH-12 | Each token has a unique jti (UUID v4) to support individual token revocation | uuidv4() on every token generation |

## RBAC Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-RBAC-01 | Role is embedded in the access token payload — no DB lookup on every request | role field in JWT payload |
| BR-RBAC-02 | Role checks are performed server-side on every protected request | authorize(roles[]) middleware |
| BR-RBAC-03 | Client-side role hiding is not a security control — server always re-validates | Never trust client-provided role |
| BR-RBAC-04 | Admin role has access to all resources | authorize(['admin']) or authorize(['student','faculty','admin']) |
| BR-RBAC-05 | Faculty can only access resources for their assigned subjects | Ownership check in service layer, not middleware |
| BR-RBAC-06 | Students can only access their own data | userId === req.user.userId check in service layer |

## Password Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-PWD-01 | Passwords must be at least 8 characters | Joi validation on create |
| BR-PWD-02 | Passwords must contain at least one uppercase, one lowercase, one digit, one special character | Joi regex on create |
| BR-PWD-03 | Passwords are hashed with bcrypt, cost factor 12 | bcrypt.hash(password, 12) |
| BR-PWD-04 | Password hash is never returned in any API response | Mongoose select: false on passwordHash field |
| BR-PWD-05 | Password comparison uses bcrypt.compare (timing-safe) | Never string equality |

## Token Security Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-TOKEN-01 | Refresh token replay attacks are detected and rejected | Stored token !== incoming token → reject |
| BR-TOKEN-02 | Refresh tokens are stored server-side (Redis) — client cannot forge them | Redis is the source of truth |
| BR-TOKEN-03 | Access tokens are stateless — validated by signature only (+ blacklist check) | No DB lookup per request |
| BR-TOKEN-04 | Blacklisted tokens are rejected even if signature is valid | Redis blacklist check in authMiddleware |
| BR-TOKEN-05 | Token secrets must be at least 256 bits (32 bytes) of entropy | Enforced by deployment documentation |

## PBT Properties (Partial Mode — PBT-02, PBT-03)

| Property | Category | Description |
|---|---|---|
| PBT-AUTH-01 | Round-trip | JWT encode → decode returns identical payload (sub, email, role, jti) |
| PBT-AUTH-02 | Invariant | bcrypt.hash(password) always produces a different hash (salted) |
| PBT-AUTH-03 | Invariant | bcrypt.compare(password, hash) returns true iff password matches original |
| PBT-AUTH-04 | Invariant | Blacklisted token is always rejected regardless of other valid fields |
| PBT-AUTH-05 | Invariant | Token with exp in the past is always rejected |
