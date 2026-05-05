# Domain Entities — Unit 1: Authentication & RBAC

## User Entity

```typescript
interface User {
  _id: ObjectId;
  email: string;              // unique, lowercase, trimmed
  passwordHash: string;       // bcrypt hash, never exposed in responses
  role: UserRole;             // 'student' | 'faculty' | 'admin'
  name: string;
  isActive: boolean;          // false = deactivated, cannot login
  collegeId: ObjectId | null; // multi-tenancy extensibility hook

  // Student discriminator fields
  rollNumber?: string;        // unique sparse index
  department?: string;
  yearSemester?: string;
  profilePhotoUrl?: string;
  phone?: string;
  parentContact?: string;

  // Faculty discriminator fields
  employeeId?: string;        // unique sparse index

  createdAt: Date;
  updatedAt: Date;
}

type UserRole = 'student' | 'faculty' | 'admin';
```

## Token Entities (Redis — not persisted in MongoDB)

```typescript
// Redis key: refresh:{userId}
interface RefreshTokenEntry {
  token: string;    // the refresh JWT value
  ttl: number;      // 7 days in seconds (604800)
}

// Redis key: blacklist:{jti}
interface BlacklistEntry {
  value: '1';
  ttl: number;      // remaining lifetime of the access token
}

// Redis key: attempts:{email}
interface FailedAttemptEntry {
  count: number;    // incremented on each failed login
  ttl: number;      // 15 minutes (900 seconds), reset on success
}

// Redis key: lock:{email}
interface AccountLockEntry {
  value: '1';
  ttl: number;      // 15 minutes (900 seconds)
}
```

## JWT Payload

```typescript
interface AccessTokenPayload {
  sub: string;      // userId (MongoDB ObjectId as string)
  email: string;
  role: UserRole;
  jti: string;      // unique token ID (UUID v4) — used for blacklisting
  iat: number;      // issued at (Unix timestamp)
  exp: number;      // expiry (iat + 900 seconds = 15 minutes)
}

interface RefreshTokenPayload {
  sub: string;      // userId
  jti: string;      // unique token ID
  iat: number;
  exp: number;      // iat + 604800 seconds = 7 days
}
```

## Role Hierarchy

```
admin
  └── Can do everything Faculty and Student can do
  └── Exclusive: user management, subject management, enrollment, settings

faculty
  └── Can do everything Student can do (read own profile)
  └── Exclusive: mark attendance, bulk upload, view subject attendance, generate subject reports

student
  └── Read own profile, view own attendance, view own notifications, download own reports
```

## Permission Matrix

| Resource / Action | Student | Faculty | Admin |
|---|---|---|---|
| Login | ✅ | ✅ | ✅ |
| Logout | ✅ | ✅ | ✅ |
| Refresh token | ✅ | ✅ | ✅ |
| View own profile | ✅ | ✅ | ✅ |
| Update own profile | ✅ (restricted fields) | ✅ | ✅ |
| Create user | ❌ | ❌ | ✅ |
| View any user | ❌ | ❌ | ✅ |
| Update any user | ❌ | ❌ | ✅ |
| Deactivate user | ❌ | ❌ | ✅ |
| Create subject | ❌ | ❌ | ✅ |
| Assign faculty | ❌ | ❌ | ✅ |
| Enroll students | ❌ | ❌ | ✅ |
| Mark attendance | ❌ | ✅ (own subjects) | ✅ |
| View subject attendance | ❌ | ✅ (own subjects) | ✅ |
| View own attendance | ✅ | ❌ | ✅ |
| View own notifications | ✅ | ❌ | ✅ |
| Generate subject report | ❌ | ✅ (own subjects) | ✅ |
| Generate own report | ✅ | ❌ | ✅ |
| Generate dept/institution report | ❌ | ❌ | ✅ |
| Update threshold | ❌ | ❌ | ✅ |
