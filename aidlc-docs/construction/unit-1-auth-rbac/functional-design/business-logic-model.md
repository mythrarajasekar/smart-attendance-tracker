# Business Logic Model — Unit 1: Authentication & RBAC

## 1. Login Flow

```
INPUT: { email, password }

Step 1: Normalize email (lowercase, trim)
Step 2: Check account lock → GET lock:{email} from Redis
        IF exists → throw AccountLockedError(retryAfter: TTL remaining)

Step 3: Find user by email in MongoDB
        IF not found → incrementFailedAttempts(email) → throw InvalidCredentialsError
        IF user.isActive === false → throw InvalidCredentialsError (same message, no info leak)

Step 4: Compare password with bcrypt.compare(password, user.passwordHash)
        IF mismatch → incrementFailedAttempts(email) → throw InvalidCredentialsError

Step 5: Reset failed attempts → DEL attempts:{email} from Redis

Step 6: Generate access token:
        payload = { sub: userId, email, role, jti: uuidv4() }
        sign with JWT_SECRET, expiresIn: '15m'

Step 7: Generate refresh token:
        payload = { sub: userId, jti: uuidv4() }
        sign with JWT_REFRESH_SECRET, expiresIn: '7d'
        SET refresh:{userId} = refreshToken, EX 604800 in Redis

Step 8: Return { accessToken, refreshToken, expiresIn: 900, user: { id, name, role } }
```

## 2. Refresh Token Rotation Flow

```
INPUT: { refreshToken }

Step 1: Verify refresh token signature and expiry using JWT_REFRESH_SECRET
        IF invalid/expired → throw InvalidRefreshTokenError

Step 2: Extract userId from payload.sub

Step 3: GET refresh:{userId} from Redis
        IF not found → throw InvalidRefreshTokenError (token already rotated or logged out)
        IF stored token !== incoming token → throw InvalidRefreshTokenError (replay attack)

Step 4: DEL refresh:{userId} from Redis (invalidate old token)

Step 5: Generate new access token (new jti)
Step 6: Generate new refresh token (new jti)
        SET refresh:{userId} = newRefreshToken, EX 604800

Step 7: Return { accessToken, refreshToken, expiresIn: 900 }
```

## 3. Logout Flow

```
INPUT: accessToken (from Authorization header), { refreshToken } (from body)

Step 1: Decode access token (without verification — already verified by authMiddleware)
        Extract jti and exp from payload

Step 2: Calculate remaining TTL = exp - Math.floor(Date.now() / 1000)
        IF remaining > 0: SET blacklist:{jti} = '1', EX remaining in Redis

Step 3: Verify refresh token to extract userId
        IF valid: DEL refresh:{userId} from Redis
        IF invalid: skip (token may already be expired — logout still succeeds)

Step 4: Return { message: 'Logged out successfully' }
```

## 4. Request Authentication Flow (Middleware)

```
INPUT: HTTP request with Authorization: Bearer {token}

Step 1: Extract token from Authorization header
        IF missing → throw AuthenticationError('No token provided')

Step 2: Verify token signature and expiry using JWT_SECRET
        IF invalid → throw AuthenticationError('Invalid token')
        IF expired → throw AuthenticationError('Token expired')

Step 3: Extract jti from payload
        GET blacklist:{jti} from Redis
        IF exists → throw AuthenticationError('Token has been revoked')

Step 4: Attach decoded payload to req.user = { userId, email, role }

Step 5: Call next() — proceed to route handler
```

## 5. RBAC Authorization Flow (Middleware)

```
INPUT: req.user (set by authenticate middleware), allowedRoles[]

Step 1: Check req.user exists (authenticate must run first)
        IF missing → throw AuthenticationError

Step 2: Check req.user.role is in allowedRoles[]
        IF not → throw AuthorizationError('Insufficient permissions')

Step 3: Call next()
```

## 6. Brute-Force Protection Logic

```
incrementFailedAttempts(email):
  Step 1: INCR attempts:{email} in Redis
          IF key is new (result === 1): SET EX 900 (15 minutes)
  Step 2: GET current count
          IF count >= 5:
            SET lock:{email} = '1', EX 900
            DEL attempts:{email}

isAccountLocked(email):
  Step 1: GET lock:{email} from Redis
          RETURN exists ? true : false

getLockTTL(email):
  Step 1: TTL lock:{email} from Redis
          RETURN ttl (seconds remaining)
```

## 7. JWT Lifecycle Summary

```
Access Token:
  Issued at:  Login, Refresh
  Expiry:     15 minutes
  Contains:   userId, email, role, jti
  Invalidated by: Blacklist (logout), Expiry
  Secret:     JWT_SECRET (env var)

Refresh Token:
  Issued at:  Login, Refresh (rotation)
  Expiry:     7 days
  Contains:   userId, jti
  Stored in:  Redis (refresh:{userId})
  Invalidated by: Rotation (each use), Logout (DEL), Expiry
  Secret:     JWT_REFRESH_SECRET (env var)
```
