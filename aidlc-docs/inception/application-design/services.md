# Service Definitions — Smart Attendance Tracker

## Service Architecture Overview

The backend follows a layered service architecture:

```
Controller Layer   → HTTP request/response handling, input validation, response formatting
Service Layer      → Business logic, orchestration, cross-component coordination
Repository Layer   → MongoDB data access via Mongoose models
Cache Layer        → Redis for tokens, deduplication, rate limiting, settings cache
External Layer     → Email provider (SendGrid/SES)
```

Each domain has a dedicated service. Cross-cutting concerns (auth, logging, validation, error handling) are handled by shared middleware.

---

## Service 1: AuthService

**File**: `src/services/auth/authService.ts`

**Responsibility**: Owns the complete authentication lifecycle — credential validation, token issuance, refresh rotation, logout, and brute-force protection.

**Orchestration**:
1. On login: validate credentials → check account lock → verify password (bcrypt) → generate token pair → store refresh token in Redis → reset failed attempts
2. On refresh: validate refresh token from Redis → rotate (delete old, store new) → return new token pair
3. On logout: blacklist access token in Redis → delete refresh token from Redis

**Dependencies**:
- `UserModel` — credential lookup
- `RedisClient` — token store, blacklist, failed attempt counters
- `bcrypt` — password verification
- `jsonwebtoken` — token generation and verification

**Redis Key Patterns**:
```
refresh:{userId}           → refresh token value, TTL: 7 days
blacklist:{jti}            → "1", TTL: remaining access token lifetime
lock:{email}               → "1", TTL: 15 minutes (lockout window)
attempts:{email}           → count, TTL: 15 minutes
```

---

## Service 2: UserService

**File**: `src/services/users/userService.ts`

**Responsibility**: Manages user account lifecycle and profile data for all three roles.

**Orchestration**:
1. On create: validate uniqueness (email, rollNumber/employeeId) → hash password → create MongoDB document
2. On profile update: enforce role-based field restrictions → validate data → update document
3. On deactivate: soft-delete (set `isActive: false`) → invalidate any active tokens via Redis blacklist

**Dependencies**:
- `UserModel` (Mongoose) — CRUD operations
- `AuthService` — token invalidation on deactivation
- `bcrypt` — password hashing on create

**Field-Level Access Control**:
```
Student can update:  name, phone, parentContact, profilePhotoUrl
Student cannot:      rollNumber, department, yearSemester, email, role
Faculty can update:  name, phone, profilePhotoUrl
Admin can update:    all fields on any user
```

---

## Service 3: SubjectService

**File**: `src/services/subjects/subjectService.ts`

**Responsibility**: Manages subject lifecycle, faculty assignments, and student enrollments.

**Orchestration**:
1. On create: validate unique subject code → create document with `collegeId`
2. On faculty assign: validate faculty user exists and has `faculty` role → add to subject's `facultyIds` array (upsert)
3. On student enroll: validate student users exist and have `student` role → add to `studentIds` array (idempotent upsert)
4. On list (role-scoped): Admin → all; Faculty → filter by `facultyIds` contains userId; Student → filter by `studentIds` contains userId

**Dependencies**:
- `SubjectModel` (Mongoose)
- `UserModel` — validate user existence and roles before assignment

---

## Service 4: AttendanceService

**File**: `src/services/attendance/attendanceService.ts`

**Responsibility**: Core attendance engine — marking, editing, bulk upload, percentage calculation.

**Orchestration**:
1. On mark: validate faculty owns subject → check for duplicates (compound index) → bulk insert records → trigger `AlertService.checkAndAlert()` for each student
2. On edit: validate faculty owns subject → check correction window (now - markedAt <= correctionWindowHours) → update record
3. On bulk upload: parse CSV/Excel → validate each row → deduplicate → batch insert → return per-row result
4. On percentage calc: aggregate `{ status: 'present' }` count and total count for student+subject → compute (attended/total)*100

**Dependencies**:
- `AttendanceModel` (Mongoose)
- `SubjectService` — validate faculty-subject ownership
- `AlertService` — trigger threshold check post-marking
- `CsvParser` — parse bulk upload files
- `SettingsService` — read correction window config

**Duplicate Prevention**:
- Compound unique index on `{ studentId, subjectId, sessionId }` in MongoDB
- Application-level check returns descriptive error before DB write

---

## Service 5: ReportService

**File**: `src/services/reports/reportService.ts`

**Responsibility**: Aggregates attendance data and generates downloadable PDF/Excel/CSV reports.

**Orchestration**:
1. Validate requester role and scope (student: own; faculty: assigned subjects; admin: all)
2. Build MongoDB aggregation pipeline for the requested scope and time range
3. Execute pipeline → get `ReportRow[]`
4. Route to `PdfGenerator` or `ExcelGenerator` based on format
5. Return buffer with filename and MIME type

**Dependencies**:
- `AttendanceModel` — aggregation source
- `UserModel` — student name/roll number lookup
- `SubjectModel` — subject name/code lookup
- `SubjectService` — faculty-subject ownership validation
- `PdfGenerator` — PDFKit report template
- `ExcelGenerator` — ExcelJS report template

**MongoDB Aggregation Pipeline (Student Monthly)**:
```
$match: { studentId, date: { $gte: monthStart, $lte: monthEnd } }
$group: { _id: { subjectId }, attended: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } }, total: { $sum: 1 } }
$lookup: subjects collection for subject name/code
$lookup: users collection for student name/roll number
$project: final ReportRow shape
```

---

## Service 6: AlertService

**File**: `src/services/notifications/alertService.ts`

**Responsibility**: Post-attendance threshold monitoring and alert orchestration.

**Orchestration**:
1. Receive `(studentId, subjectId, percentage)` from AttendanceService
2. Read global threshold from SettingsService (Redis-cached)
3. If `percentage >= threshold` → return (no alert needed)
4. Check Redis deduplication key `alert:{studentId}:{subjectId}` → if exists → return (duplicate suppressed)
5. Create in-app notification via `NotificationService.createNotification()`
6. Dispatch email via `EmailService.sendLowAttendanceAlert()`
7. Set Redis deduplication key with 24h TTL

**Dependencies**:
- `SettingsService` — threshold value
- `NotificationService` — in-app notification creation
- `EmailService` — email dispatch
- `RedisClient` — deduplication key management
- `UserModel` — student email and name lookup

---

## Service 7: NotificationService

**File**: `src/services/notifications/notificationService.ts`

**Responsibility**: CRUD operations for in-app notification records.

**Orchestration**: Standard CRUD with ownership validation (students access only their own notifications).

**Dependencies**:
- `NotificationModel` (Mongoose)

---

## Service 8: EmailService

**File**: `src/services/notifications/emailService.ts`

**Responsibility**: Email template rendering and dispatch via SendGrid/SES.

**Orchestration**:
1. Build email payload from template + data
2. Send via configured provider (SendGrid or AWS SES)
3. Log success/failure with correlation ID
4. On failure: log error, do not throw (non-blocking — alert still created in-app)

**Dependencies**:
- `@sendgrid/mail` or `aws-sdk/ses`
- `Winston logger`

---

## Service 9: SettingsService

**File**: `src/services/settings/settingsService.ts`

**Responsibility**: Global configuration management with Redis caching.

**Orchestration**:
1. On read: check Redis cache key `settings:global` → if hit, return parsed value; if miss, read MongoDB → cache with 5-minute TTL
2. On update: validate admin role → update MongoDB → invalidate Redis cache

**Dependencies**:
- `SettingsModel` (Mongoose)
- `RedisClient` — settings cache

---

## Service Interaction Map

```
HTTP Request
    |
    v
[Controller] -- validates input via Joi middleware
    |
    v
[Service Layer]
    |
    +-- AuthService ---------> Redis (tokens, blacklist, lockout)
    |                          UserModel (credential lookup)
    |
    +-- UserService ----------> UserModel
    |                          AuthService (token invalidation)
    |
    +-- SubjectService -------> SubjectModel
    |                          UserModel (role validation)
    |
    +-- AttendanceService ----> AttendanceModel
    |                          SubjectService (ownership check)
    |                          AlertService (post-mark trigger)
    |                          CsvParser (bulk upload)
    |                          SettingsService (correction window)
    |
    +-- ReportService --------> AttendanceModel (aggregation)
    |                          UserModel, SubjectModel (lookups)
    |                          PdfGenerator, ExcelGenerator
    |
    +-- AlertService ---------> SettingsService (threshold)
    |                          NotificationService (in-app)
    |                          EmailService (email)
    |                          Redis (deduplication)
    |
    +-- NotificationService --> NotificationModel
    |
    +-- EmailService ---------> SendGrid / AWS SES
    |
    +-- SettingsService ------> SettingsModel
                               Redis (cache)
```
