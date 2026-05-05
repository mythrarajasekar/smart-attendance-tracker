# Tech Stack Decisions — Unit 1: Authentication & RBAC

## Decision Log

| Component | Choice | Version | Rationale |
|---|---|---|---|
| JWT library | jsonwebtoken | 9.x | Industry standard, well-maintained, supports RS256/HS256 |
| Password hashing | bcrypt | 5.x | Adaptive, widely adopted, timing-safe comparison |
| Redis client | ioredis | 5.x | Production-grade, cluster support, TypeScript types, connection pooling |
| UUID generation | uuid | 9.x | RFC 4122 v4 UUIDs for jti claims |
| Input validation | Joi | 17.x | Schema-based, composable, excellent error messages |
| Rate limiting | express-rate-limit + rate-limit-redis | 7.x + 4.x | Distributed rate limiting backed by Redis |
| Security headers | helmet | 7.x | Comprehensive HTTP security headers in one middleware |
| PBT framework | fast-check | 3.x | Jest integration, TypeScript support, excellent shrinking |
| Test runner | Jest + ts-jest | 29.x | Standard for Node.js TypeScript projects |
| HTTP testing | Supertest | 6.x | Integration testing for Express apps |

## JWT Algorithm Decision

**Choice**: HS256 (HMAC-SHA256) with symmetric secret

**Rationale**: 
- Single-service system — no need for asymmetric keys (RS256) since only this service signs and verifies
- Simpler key management — one secret per token type
- Sufficient security with 256-bit secrets
- Lower computational overhead than RS256

**Future consideration**: If auth is extracted to a dedicated microservice that issues tokens for multiple services, migrate to RS256.

## Token Storage Decision (Frontend)

| Token | Storage | Rationale |
|---|---|---|
| Access token | Redux memory only | Short-lived (15min), never persisted — XSS cannot steal from memory |
| Refresh token | localStorage | Survives page refresh; acceptable risk given HttpOnly cookie alternative requires CORS config changes; mitigated by token rotation |

**Security note**: HttpOnly cookies would be more secure for refresh tokens but require same-origin or explicit CORS cookie configuration. localStorage is chosen for simplicity in v1 with the understanding that token rotation limits the blast radius of theft.

## Redis Data Structure Decisions

| Key Pattern | Type | TTL | Rationale |
|---|---|---|---|
| `refresh:{userId}` | String | 7 days | Simple string — one refresh token per user |
| `blacklist:{jti}` | String | Remaining token lifetime | Minimal storage — only active blacklisted tokens |
| `attempts:{email}` | String (counter) | 15 minutes | Auto-expires, no cleanup needed |
| `lock:{email}` | String | 15 minutes | Auto-expires, no cleanup needed |
| `settings:global` | String (JSON) | 5 minutes | Settings cache — see Unit 9 |

**One refresh token per user**: Storing one refresh token per userId means logging in from a new device invalidates the previous session. This is a deliberate security choice — prevents concurrent sessions. Future enhancement: store per-device tokens using `refresh:{userId}:{deviceId}`.
