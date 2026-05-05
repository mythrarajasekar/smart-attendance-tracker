# Application Design — Smart Attendance Tracker

> **Consolidated design document** covering all 12 design artifacts for Units 1–4 (prioritized).
> References: `components.md`, `component-methods.md`, `services.md`, `component-dependency.md`

---

## 1. Domain Model

### Core Domain Entities

```
+------------------+       +------------------+       +------------------+
|      User        |       |     Subject      |       |   Attendance     |
+------------------+       +------------------+       +------------------+
| _id: ObjectId    |       | _id: ObjectId    |       | _id: ObjectId    |
| email: string    |       | name: string     |       | studentId: ObjId |
| passwordHash:str |       | code: string     |       | subjectId: ObjId |
| role: enum       |       | department: str  |       | sessionId: string|
| name: string     |       | semester: string |       | date: Date       |
| isActive: bool   |       | academicYear:str |       | status: enum     |
| collegeId: ObjId |       | facultyIds:[ObjId|       | markedBy: ObjId  |
| createdAt: Date  |       | studentIds:[ObjId|       | markedAt: Date   |
| updatedAt: Date  |       | collegeId: ObjId |       | collegeId: ObjId |
+------------------+       | createdAt: Date  |       | createdAt: Date  |
       |                   +------------------+       +------------------+
       | (discriminator)
  +---------+-----------+
  |         |           |
+-------+ +--------+ +-------+
|Student| |Faculty | | Admin |
+-------+ +--------+ +-------+
|rollNo | |empId   | |       |
|dept   | |dept    | |       |
|year   | |        | |       |
|photo  | |        | |       |
|phone  | |        | |       |
|parent | |        | |       |
+-------+ +--------+ +-------+

+------------------+       +------------------+
|  Notification    |       |    Settings      |
+------------------+       +------------------+
| _id: ObjectId    |       | _id: ObjectId    |
| userId: ObjId    |       | key: string      |
| subjectId: ObjId |       | value: Mixed     |
| type: enum       |       | updatedBy: ObjId |
| message: string  |       | updatedAt: Date  |
| read: boolean    |       +------------------+
| emailSentAt: Date|
| createdAt: Date  |
+------------------+
```

---

## 2. Entity Relationship Diagram

```
[User] 1 ----< [Attendance] >---- 1 [Subject]
  |                                     |
  | (facultyIds)                        |
  +---- M ---- [Subject] ---- M --------+
  |                                     |
  | (studentIds)                        |
  +---- M ---- [Subject] ---- M --------+

[User (Student)] 1 ----< [Notification]

[Settings] (singleton document, key-value store)

Relationships:
- User (Student) has many Attendance records
- User (Faculty) marks many Attendance records (markedBy)
- Subject has many Faculty (facultyIds array)
- Subject has many Students (studentIds array)
- Attendance belongs to one Student and one Subject
- Notification belongs to one Student
- Settings is a global singleton
```

---

## 3. Database Collections and Schemas

### Collection: `users`

```javascript
{
  _id: ObjectId,
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  name: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  collegeId: { type: ObjectId, ref: 'College', default: null },  // multi-tenancy hook

  // Student-specific (populated when role === 'student')
  rollNumber: { type: String, sparse: true, unique: true },
  department: { type: String },
  yearSemester: { type: String },
  profilePhotoUrl: { type: String },
  phone: { type: String },
  parentContact: { type: String },

  // Faculty-specific (populated when role === 'faculty')
  employeeId: { type: String, sparse: true, unique: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}

Indexes:
  { email: 1 }                    unique
  { rollNumber: 1 }               sparse unique
  { employeeId: 1 }               sparse unique
  { role: 1, isActive: 1 }        compound (admin list queries)
  { department: 1, role: 1 }      compound (department reports)
```

### Collection: `subjects`

```javascript
{
  _id: ObjectId,
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true },
  department: { type: String, required: true },
  semester: { type: String, required: true },
  academicYear: { type: String, required: true },
  facultyIds: [{ type: ObjectId, ref: 'User' }],
  studentIds: [{ type: ObjectId, ref: 'User' }],
  collegeId: { type: ObjectId, default: null },  // multi-tenancy hook
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}

Indexes:
  { code: 1, academicYear: 1 }    unique compound
  { facultyIds: 1 }               (faculty subject queries)
  { studentIds: 1 }               (student subject queries)
  { department: 1 }               (department reports)
```

### Collection: `attendance`

```javascript
{
  _id: ObjectId,
  studentId: { type: ObjectId, ref: 'User', required: true },
  subjectId: { type: ObjectId, ref: 'Subject', required: true },
  sessionId: { type: String, required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent'], required: true },
  markedBy: { type: ObjectId, ref: 'User', required: true },
  markedAt: { type: Date, default: Date.now },
  collegeId: { type: ObjectId, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}

Indexes:
  { studentId: 1, subjectId: 1, sessionId: 1 }   unique compound (duplicate prevention)
  { subjectId: 1, date: 1 }                       (faculty view, report aggregation)
  { studentId: 1, subjectId: 1 }                  (percentage calculation)
  { date: 1 }                                     (monthly report range queries)
```

### Collection: `notifications`

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', required: true },
  subjectId: { type: ObjectId, ref: 'Subject', required: true },
  type: { type: String, enum: ['low_attendance'], required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  emailSentAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}

Indexes:
  { userId: 1, read: 1 }          (student notification list)
  { userId: 1, createdAt: -1 }    (sorted notification list)
```

### Collection: `settings`

```javascript
{
  _id: ObjectId,
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedBy: { type: ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
}

Seed data:
  { key: 'attendanceThreshold', value: 75 }
  { key: 'correctionWindowHours', value: 48 }

Indexes:
  { key: 1 }    unique
```

---

## 4. API Contracts

### Unit 1: Authentication & RBAC

```
POST /api/v1/auth/login
  Request:  { email: string, password: string }
  Response 200: { accessToken: string, refreshToken: string, expiresIn: number, user: { id, name, role } }
  Response 401: { error: 'INVALID_CREDENTIALS', message: string }
  Response 423: { error: 'ACCOUNT_LOCKED', message: string, retryAfter: number }
  Response 429: { error: 'RATE_LIMIT_EXCEEDED', message: string }

POST /api/v1/auth/refresh
  Request:  { refreshToken: string }
  Response 200: { accessToken: string, refreshToken: string, expiresIn: number }
  Response 401: { error: 'INVALID_REFRESH_TOKEN', message: string }

POST /api/v1/auth/logout
  Headers:  Authorization: Bearer {accessToken}
  Request:  { refreshToken: string }
  Response 200: { message: 'Logged out successfully' }
  Response 401: { error: 'UNAUTHORIZED', message: string }
```

### Unit 2: User & Profile Management

```
GET /api/v1/users/me
  Headers:  Authorization: Bearer {token}
  Response 200: UserProfile object

PUT /api/v1/users/me
  Headers:  Authorization: Bearer {token}
  Request:  { name?, phone?, parentContact?, profilePhotoUrl? }
  Response 200: Updated UserProfile
  Response 400: { error: 'VALIDATION_ERROR', details: [...] }
  Response 403: { error: 'FORBIDDEN_FIELD', message: string }

POST /api/v1/users                          [Admin only]
  Request:  CreateUserDto
  Response 201: UserProfile
  Response 409: { error: 'DUPLICATE_EMAIL' | 'DUPLICATE_ROLL_NUMBER' }

GET /api/v1/users/:id                       [Admin only]
  Response 200: UserProfile
  Response 404: { error: 'USER_NOT_FOUND' }

PUT /api/v1/users/:id                       [Admin only]
  Request:  AdminUpdateUserDto
  Response 200: UserProfile

DELETE /api/v1/users/:id                    [Admin only]
  Response 200: { message: 'User deactivated' }

GET /api/v1/users?role=&department=&page=&limit=   [Admin only]
  Response 200: { data: UserProfile[], total: number, page: number, limit: number }
```

### Unit 3: Subject Management

```
POST /api/v1/subjects                       [Admin only]
  Request:  { name, code, department, semester, academicYear }
  Response 201: SubjectDocument
  Response 409: { error: 'DUPLICATE_SUBJECT_CODE' }

GET /api/v1/subjects?department=&semester=&page=&limit=
  Response 200: { data: SubjectDocument[], total, page, limit }
  [Role-scoped: Admin=all, Faculty=assigned, Student=enrolled]

GET /api/v1/subjects/:id
  Response 200: SubjectDetail (with facultyIds, studentIds populated)
  Response 404: { error: 'SUBJECT_NOT_FOUND' }

PUT /api/v1/subjects/:id                    [Admin only]
  Request:  { name?, department?, semester? }
  Response 200: SubjectDocument

DELETE /api/v1/subjects/:id                 [Admin only]
  Response 200: { message: 'Subject deleted' }
  Response 409: { error: 'SUBJECT_HAS_ATTENDANCE', message: string }

POST /api/v1/subjects/:id/faculty           [Admin only]
  Request:  { facultyId: string }
  Response 200: { message: 'Faculty assigned' }
  Response 404: { error: 'FACULTY_NOT_FOUND' }
  Response 422: { error: 'NOT_A_FACULTY_USER' }

DELETE /api/v1/subjects/:id/faculty/:facultyId   [Admin only]
  Response 200: { message: 'Faculty removed' }

POST /api/v1/subjects/:id/students          [Admin only]
  Request:  { studentIds: string[] }
  Response 200: EnrollmentResult { enrolled, alreadyEnrolled, failed }

DELETE /api/v1/subjects/:id/students/:studentId  [Admin only]
  Response 200: { message: 'Student unenrolled' }

GET /api/v1/subjects/:id/students?page=&limit=   [Faculty + Admin]
  Response 200: { data: UserProfile[], total, page, limit }
```

### Unit 4: Attendance Engine

```
POST /api/v1/attendance                     [Faculty only]
  Request:  { subjectId, sessionId, date, records: [{ studentId, status }] }
  Response 201: AttendanceMarkResult { total, marked, duplicates }
  Response 403: { error: 'NOT_SUBJECT_FACULTY' }
  Response 422: { error: 'DUPLICATE_SESSION' }

PUT /api/v1/attendance/:id                  [Faculty only]
  Request:  { status: 'present' | 'absent' }
  Response 200: AttendanceRecord
  Response 403: { error: 'CORRECTION_WINDOW_EXPIRED', windowHours: number }
  Response 404: { error: 'RECORD_NOT_FOUND' }

POST /api/v1/attendance/bulk-upload         [Faculty only]
  Request:  multipart/form-data { file: CSV/Excel, subjectId: string }
  Response 200: BulkUploadResult { total, success, duplicates, errors: [{ row, reason }] }
  Response 400: { error: 'INVALID_FILE_FORMAT' }
  Response 413: { error: 'FILE_TOO_LARGE', maxSizeMb: number }

GET /api/v1/attendance/subject/:id?date=&page=&limit=   [Faculty + Admin]
  Response 200: { data: AttendanceRecord[], total, page, limit }

GET /api/v1/attendance/student/:id?subjectId=&page=&limit=   [Student (own) + Admin]
  Response 200: { data: AttendanceRecord[], total, page, limit }

GET /api/v1/attendance/student/:id/subject/:subjectId/percentage
  Response 200: AttendancePercentage { studentId, subjectId, attended, total, percentage }
```

---

## 5. Service Interfaces

See `services.md` for complete service interface definitions including method signatures, orchestration flows, and dependency maps.

Key interface contracts:

```typescript
interface IAuthService {
  login(email: string, password: string): Promise<TokenPair>;
  refreshTokens(refreshToken: string): Promise<TokenPair>;
  logout(userId: string, accessToken: string): Promise<void>;
}

interface IAttendanceService {
  markAttendance(facultyId: string, data: MarkAttendanceDto): Promise<AttendanceMarkResult>;
  calculatePercentage(studentId: string, subjectId: string): Promise<AttendancePercentage>;
  bulkUploadAttendance(facultyId: string, subjectId: string, file: Buffer, mimeType: string): Promise<BulkUploadResult>;
}

interface IAlertService {
  checkAndAlert(studentId: string, subjectId: string, percentage: number): Promise<void>;
}
```

---

## 6. Sequence Diagrams

See `component-dependency.md` for 6 detailed sequence diagrams:
1. Login Flow
2. Authenticated Request Flow
3. Mark Attendance + Alert Trigger
4. Token Refresh Flow
5. Report Generation Flow
6. Logout + Token Blacklist

---

## 7. Request/Response Contracts

### Standard Response Envelope

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {                    // present on paginated responses
    "total": number,
    "page": number,
    "limit": number,
    "totalPages": number
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",      // machine-readable constant
    "message": "Human-readable description",
    "details": [...]           // validation errors array (optional)
  },
  "correlationId": "uuid"      // for support/debugging
}
```

### HTTP Status Code Conventions

| Status | Usage |
|---|---|
| 200 | Successful GET, PUT, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Validation error (malformed request) |
| 401 | Unauthenticated (missing/invalid/expired token) |
| 403 | Unauthorized (authenticated but insufficient role/ownership) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 413 | Payload too large (file upload) |
| 422 | Business rule violation (correction window expired, etc.) |
| 423 | Account locked (brute-force protection) |
| 429 | Rate limit exceeded |
| 500 | Internal server error (generic, no details exposed) |

---

## 8. Validation Rules

### Auth Validation

```
email:    required, string, valid email format, max 255 chars, lowercase
password: required, string, min 8 chars, max 128 chars
          (on create: must contain uppercase, lowercase, digit, special char)
```

### User Validation

```
name:           required, string, min 2, max 100 chars, trim
rollNumber:     required for students, string, alphanumeric + hyphen, max 20 chars
employeeId:     required for faculty, string, alphanumeric + hyphen, max 20 chars
department:     required, string, max 100 chars
yearSemester:   optional, string, pattern: /^\d{1,2}(st|nd|rd|th)\s(Sem|Year)$/i
phone:          optional, string, E.164 format or 10-digit local
parentContact:  optional, string, max 200 chars
profilePhotoUrl: optional, string, valid HTTPS URL, max 500 chars
```

### Subject Validation

```
name:         required, string, min 2, max 200 chars
code:         required, string, alphanumeric + hyphen, max 20 chars, uppercase
department:   required, string, max 100 chars
semester:     required, string, max 20 chars
academicYear: required, string, pattern: /^\d{4}-\d{4}$/ (e.g., 2024-2025)
```

### Attendance Validation

```
subjectId:  required, valid MongoDB ObjectId
sessionId:  required, string, max 100 chars (e.g., "2024-01-15-slot1")
date:       required, ISO 8601 date, not in future
records:    required, array, min 1 item, max 500 items per request
  studentId: required, valid MongoDB ObjectId
  status:    required, enum: ['present', 'absent']

Bulk upload:
  file:      required, MIME type: text/csv | application/vnd.ms-excel |
             application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  maxSize:   5 MB
  maxRows:   1000 rows per file
```

### Report Validation

```
month:  required, integer, 1-12
year:   required, integer, 2000-2100
format: required, enum: ['pdf', 'excel', 'csv']
```

### Settings Validation

```
threshold: required, number, min 1, max 100, integer
```

---

## 9. Business Rules

### Authentication & RBAC

| Rule ID | Rule |
|---|---|
| BR-AUTH-01 | Access tokens expire after 15 minutes |
| BR-AUTH-02 | Refresh tokens expire after 7 days |
| BR-AUTH-03 | Refresh tokens are single-use — rotated on each use |
| BR-AUTH-04 | On logout, access token is blacklisted for its remaining TTL |
| BR-AUTH-05 | After 5 consecutive failed login attempts, account is locked for 15 minutes |
| BR-AUTH-06 | Successful login resets the failed attempt counter |
| BR-AUTH-07 | All routes require authentication except POST /auth/login |

### User Management

| Rule ID | Rule |
|---|---|
| BR-USER-01 | Email addresses must be unique across all users |
| BR-USER-02 | Roll numbers must be unique across all students |
| BR-USER-03 | Employee IDs must be unique across all faculty |
| BR-USER-04 | Students cannot modify their rollNumber, department, yearSemester, email, or role |
| BR-USER-05 | Deactivated users cannot log in |
| BR-USER-06 | Deactivating a user invalidates all their active tokens |

### Subject Management

| Rule ID | Rule |
|---|---|
| BR-SUBJ-01 | Subject codes must be unique within an academic year |
| BR-SUBJ-02 | Only Admin can create, update, or delete subjects |
| BR-SUBJ-03 | Only Admin can assign faculty or enroll students |
| BR-SUBJ-04 | Enrolling an already-enrolled student is idempotent (no error, no duplicate) |
| BR-SUBJ-05 | A subject with existing attendance records cannot be deleted |
| BR-SUBJ-06 | Faculty can only view and mark attendance for their assigned subjects |

### Attendance Engine

| Rule ID | Rule |
|---|---|
| BR-ATT-01 | Attendance percentage = (classes attended / total classes held) × 100, rounded to 2 decimal places |
| BR-ATT-02 | If no classes have been held, percentage = 0 (no division by zero) |
| BR-ATT-03 | Duplicate records (same studentId + subjectId + sessionId) are rejected |
| BR-ATT-04 | Faculty can only mark attendance for subjects they are assigned to |
| BR-ATT-05 | Attendance records can be edited within the correction window (default: 48 hours from markedAt) |
| BR-ATT-06 | Editing outside the correction window returns HTTP 422 |
| BR-ATT-07 | Bulk upload rows with duplicate sessionId are counted as duplicates, not errors |
| BR-ATT-08 | Bulk upload rows with invalid studentId (not enrolled in subject) are counted as errors |
| BR-ATT-09 | Percentage is always in the range [0, 100] |
| BR-ATT-10 | Total classes held >= classes attended (invariant) |

### Alerts & Notifications

| Rule ID | Rule |
|---|---|
| BR-ALERT-01 | Alert is triggered when percentage < global threshold |
| BR-ALERT-02 | No alert is sent when percentage >= threshold |
| BR-ALERT-03 | Duplicate alerts for the same student+subject are suppressed within a 24-hour window |
| BR-ALERT-04 | Alert includes: student name, subject name, current percentage, threshold |
| BR-ALERT-05 | Email delivery failure does not prevent in-app notification creation |
| BR-ALERT-06 | Default threshold is 75%; Admin can change it globally |

---

## 10. Error Handling Strategy

### Layered Error Handling

```
Layer 1: Validation Middleware (Joi)
  - Catches malformed requests before they reach controllers
  - Returns 400 with field-level error details
  - Never reaches service layer

Layer 2: Controller Layer
  - Wraps service calls in try/catch
  - Maps known error types to HTTP status codes
  - Passes unknown errors to global error handler

Layer 3: Service Layer
  - Throws typed application errors (AppError subclasses)
  - Never returns null for not-found (throws NotFoundError)
  - Never swallows errors silently

Layer 4: Global Error Handler (Express)
  - Catches all unhandled errors
  - Logs full error with stack trace and correlationId via Winston
  - Returns generic 500 response to client (no internal details)
  - Handles async errors via express-async-errors wrapper
```

### Error Type Hierarchy

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: unknown
  ) {}
}

class ValidationError extends AppError    // 400
class AuthenticationError extends AppError // 401
class AuthorizationError extends AppError  // 403
class NotFoundError extends AppError       // 404
class ConflictError extends AppError       // 409
class BusinessRuleError extends AppError   // 422
class RateLimitError extends AppError      // 429
```

### External Service Failure Handling

| Service | Failure Behavior |
|---|---|
| Redis unavailable | Auth: fail closed (reject request). Rate limiter: fail open (allow request, log warning) |
| MongoDB unavailable | Fail closed — return 503 Service Unavailable |
| Email service failure | Non-blocking — log error, in-app notification still created, no retry in v1 |
| CSV parse error | Return per-row error report, do not fail entire upload |

---

## 11. Security Boundaries

### Boundary Map

```
PUBLIC (no auth required):
  POST /api/v1/auth/login

AUTHENTICATED (any valid role):
  POST /api/v1/auth/logout
  POST /api/v1/auth/refresh
  GET  /api/v1/users/me
  PUT  /api/v1/users/me
  GET  /api/v1/settings (threshold value only)

STUDENT ONLY (own data):
  GET  /api/v1/attendance/student/:id          (own id only)
  GET  /api/v1/attendance/student/:id/subject/:subjectId/percentage (own id only)
  GET  /api/v1/notifications                   (own only)
  PUT  /api/v1/notifications/:id/read          (own only)
  PUT  /api/v1/notifications/read-all          (own only)
  DELETE /api/v1/notifications/:id             (own only)
  GET  /api/v1/reports/student/:id/monthly     (own id only)
  GET  /api/v1/subjects                        (enrolled subjects only)

FACULTY ONLY (assigned subjects):
  POST /api/v1/attendance
  PUT  /api/v1/attendance/:id
  POST /api/v1/attendance/bulk-upload
  GET  /api/v1/attendance/subject/:id          (assigned subjects only)
  GET  /api/v1/subjects/:id/students           (assigned subjects only)
  GET  /api/v1/reports/subject/:id/monthly     (assigned subjects only)

ADMIN ONLY:
  POST   /api/v1/users
  GET    /api/v1/users
  GET    /api/v1/users/:id
  PUT    /api/v1/users/:id
  DELETE /api/v1/users/:id
  POST   /api/v1/subjects
  PUT    /api/v1/subjects/:id
  DELETE /api/v1/subjects/:id
  POST   /api/v1/subjects/:id/faculty
  DELETE /api/v1/subjects/:id/faculty/:facultyId
  POST   /api/v1/subjects/:id/students
  DELETE /api/v1/subjects/:id/students/:studentId
  PUT    /api/v1/settings/threshold
  GET    /api/v1/reports/department/:dept/monthly
  GET    /api/v1/reports/institution/monthly
```

### SECURITY Rule Compliance Summary (Requirements Phase)

| Rule | Status | Notes |
|---|---|---|
| SECURITY-01 (Encryption at rest/transit) | Planned | MongoDB Atlas encryption + TLS 1.2+ enforced |
| SECURITY-02 (Access logging) | Planned | Morgan + Winston + Cloud ALB access logs |
| SECURITY-03 (App-level logging) | Planned | Winston structured logging with correlation IDs |
| SECURITY-04 (HTTP security headers) | Planned | helmet.js middleware |
| SECURITY-05 (Input validation) | Planned | Joi validation on all endpoints |
| SECURITY-06 (Least privilege) | Planned | Role-scoped endpoints, no wildcard permissions |
| SECURITY-07 (Network config) | Planned | Cloud security groups, private subnets for DB |
| SECURITY-08 (App-level access control) | Planned | RBAC middleware + IDOR checks in service layer |
| SECURITY-09 (Hardening) | Planned | No default creds, generic error messages, no stack traces |
| SECURITY-10 (Supply chain) | Planned | package-lock.json, npm audit in CI |
| SECURITY-11 (Secure design) | Planned | Rate limiting, auth module isolation, misuse cases |
| SECURITY-12 (Auth & credentials) | Planned | bcrypt, JWT rotation, brute-force lockout, no hardcoded secrets |
| SECURITY-13 (Integrity) | Planned | No unsafe deserialization, SRI for CDN assets |
| SECURITY-14 (Alerting & monitoring) | Planned | Cloud monitoring, log retention, auth failure alerts |
| SECURITY-15 (Exception handling) | Planned | Global error handler, fail closed, resource cleanup |

---

## 12. Component Interaction Diagrams

See `component-dependency.md` for complete interaction diagrams including:
- Login Flow
- Authenticated Request Flow
- Mark Attendance + Alert Trigger (most complex interaction)
- Token Refresh Flow
- Report Generation Flow
- Logout + Token Blacklist
- Full Data Flow Diagram (Admin → Faculty → Student data paths)

### Summary Interaction Map

```
[React Frontend]
      |
      | HTTPS + JWT Bearer
      v
[Nginx / ALB] --> rate limiting, SSL termination
      |
      v
[Express Router]
      |
      +--[authMiddleware]--> Redis (blacklist check)
      |
      +--[validateRequest]--> Joi schema
      |
      v
[Controller]
      |
      v
[Service Layer]
      |
      +-- AuthService -------> Redis + MongoDB
      +-- UserService -------> MongoDB
      +-- SubjectService ----> MongoDB
      +-- AttendanceService -> MongoDB + SubjectService + AlertService
      +-- ReportService -----> MongoDB (aggregation) + PDF/Excel generators
      +-- AlertService ------> Redis + NotificationService + EmailService
      +-- NotificationService-> MongoDB
      +-- EmailService ------> SendGrid / AWS SES
      +-- SettingsService ---> Redis + MongoDB
```
