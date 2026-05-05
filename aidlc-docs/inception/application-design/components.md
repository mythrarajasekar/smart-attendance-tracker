# Application Components — Smart Attendance Tracker

## Component Overview

The system is organized into 6 application domain components plus shared infrastructure components. Each component owns a bounded context and exposes a defined interface.

---

## Component 1: Auth Component

**Purpose**: Manages authentication, token lifecycle, and RBAC enforcement across the entire system.

**Responsibilities**:
- Validate user credentials (email + bcrypt password comparison)
- Issue JWT access tokens (15-minute expiry) and refresh tokens (7-day expiry)
- Store refresh tokens in Redis with TTL
- Rotate refresh tokens on each use (invalidate old, issue new)
- Blacklist tokens on logout via Redis
- Enforce role-based access control on every protected route
- Implement brute-force protection (account lockout after 5 failed attempts)
- Provide RBAC middleware consumed by all other components

**Interfaces**:
- `POST /auth/login` — credential validation, token issuance
- `POST /auth/logout` — token blacklisting
- `POST /auth/refresh` — refresh token rotation
- `authMiddleware(roles[])` — Express middleware factory for route protection

**Security Boundary**: All tokens validated server-side on every request. Redis blacklist checked before any protected operation.

---

## Component 2: User Component

**Purpose**: Manages user accounts and profiles for all three roles (Student, Faculty, Admin).

**Responsibilities**:
- Create, read, update, and deactivate user accounts (Admin only for create/deactivate)
- Store and retrieve extended student profiles (photo URL, phone, parent contact)
- Store and retrieve faculty profiles (employee ID, department, assigned subjects)
- Enforce field-level access control (students cannot modify roll number or department)
- Provide user lookup utilities consumed by other components

**Interfaces**:
- `GET /users/me` — current user profile
- `PUT /users/me` — update own profile (role-scoped fields)
- `POST /users` — create user (Admin only)
- `GET /users/:id` — get user by ID (Admin only)
- `PUT /users/:id` — update user (Admin only)
- `DELETE /users/:id` — deactivate user (Admin only)
- `GET /users` — paginated user list (Admin only)

**Security Boundary**: Students access only their own profile. Admin accesses all. IDOR prevention enforced at service layer.

---

## Component 3: Subject Component

**Purpose**: Manages academic subjects, faculty assignments, and student enrollments.

**Responsibilities**:
- Create and manage subjects with metadata (name, code, department, semester)
- Assign faculty members to subjects (Admin only)
- Enroll and unenroll students from subjects (Admin only)
- Provide subject and enrollment queries consumed by Attendance and Report components
- Include `collegeId` field on all records for future multi-tenancy extensibility

**Interfaces**:
- `POST /subjects` — create subject (Admin)
- `GET /subjects` — list subjects (role-scoped)
- `GET /subjects/:id` — get subject detail
- `PUT /subjects/:id` — update subject (Admin)
- `DELETE /subjects/:id` — delete subject (Admin)
- `POST /subjects/:id/faculty` — assign faculty (Admin)
- `DELETE /subjects/:id/faculty/:facultyId` — remove faculty (Admin)
- `POST /subjects/:id/students` — enroll students (Admin)
- `DELETE /subjects/:id/students/:studentId` — unenroll student (Admin)
- `GET /subjects/:id/students` — list enrolled students (Faculty + Admin)

**Security Boundary**: Only Admin mutates subjects and enrollments. Faculty reads their assigned subjects. Students read their enrolled subjects.

---

## Component 4: Attendance Component

**Purpose**: Core attendance engine — handles manual marking, bulk CSV/Excel upload, duplicate prevention, and percentage calculation.

**Responsibilities**:
- Accept manual per-student attendance marking from Faculty
- Parse and validate CSV/Excel bulk upload files
- Prevent duplicate attendance records (same student + subject + session)
- Calculate attendance percentage: (attended / total) × 100
- Enforce correction window for editing past records
- Provide attendance data consumed by Alert and Report components

**Interfaces**:
- `POST /attendance` — mark session attendance (Faculty)
- `PUT /attendance/:id` — edit attendance record (Faculty, within correction window)
- `POST /attendance/bulk-upload` — CSV/Excel bulk upload (Faculty)
- `GET /attendance/subject/:id` — all attendance for a subject (Faculty + Admin)
- `GET /attendance/student/:id` — student's attendance history (Student + Admin)
- `GET /attendance/student/:id/subject/:subjectId/percentage` — percentage for student/subject

**Security Boundary**: Faculty marks only their assigned subjects. Students view only their own records. IDOR enforced at service layer.

---

## Component 5: Report Component

**Purpose**: Generates monthly attendance reports in PDF and Excel/CSV formats with role-scoped data access.

**Responsibilities**:
- Aggregate attendance data via MongoDB pipelines for monthly summaries
- Generate downloadable PDF reports using PDFKit
- Generate downloadable Excel/CSV reports using ExcelJS
- Scope report data by role (student: own data; faculty: assigned subjects; admin: all)
- Support filtering by month, year, subject, department, and institution

**Interfaces**:
- `GET /reports/student/:id/monthly` — student monthly report (Student + Admin)
- `GET /reports/subject/:id/monthly` — subject monthly report (Faculty + Admin)
- `GET /reports/department/:dept/monthly` — department report (Admin)
- `GET /reports/institution/monthly` — institution-wide report (Admin)
- Query params: `month`, `year`, `format` (pdf | excel | csv)

**Security Boundary**: Students download only their own reports. Faculty scoped to assigned subjects. Admin unrestricted.

---

## Component 6: Notification Component

**Purpose**: Monitors attendance thresholds, triggers alerts, and delivers in-app and email notifications.

**Responsibilities**:
- Check attendance percentage against global threshold after each marking event
- Deduplicate alerts using Redis (suppress duplicate alerts within 24-hour window)
- Create in-app notification records in MongoDB
- Dispatch email alerts via SendGrid/SES
- Provide notification CRUD for student dashboard

**Interfaces**:
- `GET /notifications` — paginated notification list (Student, own only)
- `PUT /notifications/:id/read` — mark notification as read
- `PUT /notifications/read-all` — mark all as read
- `DELETE /notifications/:id` — delete notification
- Internal: `alertService.checkAndAlert(studentId, subjectId, percentage)` — called by Attendance Component

**Security Boundary**: Students access only their own notifications. Alert trigger is internal (not a public endpoint).

---

## Shared Infrastructure Components

### Auth Middleware
- `authenticate()` — verifies JWT, checks Redis blacklist, attaches user context to request
- `authorize(roles[])` — checks user role against allowed roles, returns 403 if unauthorized

### Validation Middleware
- `validateBody(schema)` — Joi schema validation for request bodies
- `validateQuery(schema)` — Joi schema validation for query parameters
- `validateParams(schema)` — Joi schema validation for route parameters

### Rate Limiter
- Redis-backed distributed rate limiting via `express-rate-limit` + `rate-limit-redis`
- Applied globally and per-endpoint (stricter on auth endpoints)

### Security Headers
- `helmet()` middleware applied globally: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy

### Request Logger
- Morgan HTTP request logging + Winston structured logging
- Correlation ID injected on every request via `x-correlation-id` header or UUID generation

### Global Error Handler
- Catches all unhandled errors
- Returns generic error messages to clients (no stack traces in production)
- Logs full error details with correlation ID via Winston

### Redis Client
- `ioredis` singleton with connection pooling
- Used by: Auth (token store/blacklist), Rate Limiter, Alert deduplication

### Settings Component
- `GET /settings` — read global settings (Admin + authenticated users for threshold value)
- `PUT /settings/threshold` — update attendance threshold (Admin only)
- Cached in Redis with TTL to avoid repeated DB reads
