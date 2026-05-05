# Component Dependencies — Smart Attendance Tracker

## Dependency Matrix

| Component | Depends On | Communication Pattern |
|---|---|---|
| AuthService | UserModel, Redis, bcrypt, jsonwebtoken | Direct call |
| UserService | UserModel, AuthService | Direct call |
| SubjectService | SubjectModel, UserModel | Direct call |
| AttendanceService | AttendanceModel, SubjectService, AlertService, CsvParser, SettingsService | Direct call + event trigger |
| ReportService | AttendanceModel, UserModel, SubjectModel, SubjectService, PdfGenerator, ExcelGenerator | Direct call |
| AlertService | SettingsService, NotificationService, EmailService, Redis, UserModel | Direct call (async, non-blocking) |
| NotificationService | NotificationModel | Direct call |
| EmailService | SendGrid/SES SDK | External HTTP |
| SettingsService | SettingsModel, Redis | Direct call + cache |

---

## Unit Build Order (Dependency-Driven)

```
Unit 1: Auth & RBAC
  Depends on: nothing
  Provides: authMiddleware, authorize(), JWT token pair, Redis token store

Unit 2: User & Profile Management
  Depends on: Unit 1 (authMiddleware, UserModel)
  Provides: UserModel, user lookup utilities

Unit 3: Subject Management
  Depends on: Unit 1, Unit 2 (UserModel for role validation)
  Provides: SubjectModel, enrollment queries

Unit 4: Attendance Engine
  Depends on: Unit 1, Unit 2, Unit 3 (SubjectService for ownership)
  Provides: AttendanceModel, percentage calculation, alert trigger

Unit 5: Reporting Engine
  Depends on: Unit 1, Unit 2, Unit 3, Unit 4 (all data sources)
  Provides: PDF/Excel report buffers

Unit 6: Alert & Notification System
  Depends on: Unit 1, Unit 2, Unit 3, Unit 4 (triggered by attendance events)
  Provides: In-app notifications, email alerts

Unit 7: Infrastructure
  Depends on: Units 1-6 (all application code complete)
  Provides: Cloud deployment, CI/CD, managed services
```

---

## Component Interaction Diagrams

### Diagram 1: Login Flow

```
Client          AuthController    AuthService       UserModel    Redis
  |                  |                |                 |          |
  |-- POST /login -->|                |                 |          |
  |                  |-- login() ---->|                 |          |
  |                  |               |-- findByEmail -->|          |
  |                  |               |<-- user doc -----|          |
  |                  |               |-- isLocked? ---->|          |
  |                  |               |<-- false --------|          |
  |                  |               |-- bcrypt.compare(pwd, hash) |
  |                  |               |-- generateAccessToken()     |
  |                  |               |-- generateRefreshToken() -->|
  |                  |               |                  |  SET refresh:{id}
  |                  |               |-- resetAttempts->|          |
  |<-- 200 {tokens}--|               |                 |          |
```

### Diagram 2: Authenticated Request Flow

```
Client          Nginx/ALB    authMiddleware    Redis    Controller    Service
  |                 |              |             |           |           |
  |-- GET /api/* -->|              |             |           |           |
  |                 |-- forward -->|             |           |           |
  |                 |             |-- verify JWT |           |           |
  |                 |             |-- check blacklist:{jti}->|           |
  |                 |             |<-- not found (valid) ----|           |
  |                 |             |-- attach req.user        |           |
  |                 |             |-- authorize(roles[]) --->|           |
  |                 |             |                          |-- call -->|
  |                 |             |                          |<-- data --|
  |<-- 200 data ----|             |                          |           |
```

### Diagram 3: Mark Attendance + Alert Trigger

```
Faculty     AttendanceController  AttendanceService  SubjectService  AlertService  NotificationService  EmailService  Redis
  |               |                     |                  |              |                |               |           |
  |-- POST /att ->|                     |                  |              |                |               |           |
  |               |-- markAttendance -->|                  |              |                |               |           |
  |               |                    |-- validateOwner ->|              |                |               |           |
  |               |                    |<-- valid ---------|              |                |               |           |
  |               |                    |-- checkDuplicate (DB index)      |                |               |           |
  |               |                    |-- bulkInsert records             |                |               |           |
  |               |                    |-- calcPercentage()               |                |               |           |
  |               |                    |-- checkAndAlert() -------------->|                |               |           |
  |               |                    |                  |              |-- isDuplicate ->|               |           |
  |               |                    |                  |              |<-- false -------|               |           |
  |               |                    |                  |              |-- createNotif ->|               |           |
  |               |                    |                  |              |-- sendEmail ----|-------------->|           |
  |               |                    |                  |              |-- setAlertKey ->|               |           SET alert:{id}:{subj}
  |<-- 201 result-|                    |                  |              |                |               |           |
```

### Diagram 4: Token Refresh Flow

```
Client          AuthController    AuthService       Redis
  |                  |                |               |
  |-- POST /refresh->|                |               |
  |  { refreshToken }|                |               |
  |                  |-- refreshTokens()              |
  |                  |               |-- GET refresh:{userId} -->|
  |                  |               |<-- stored token ----------|
  |                  |               |-- compare tokens          |
  |                  |               |-- DEL refresh:{userId} -->|
  |                  |               |-- generateNewPair()       |
  |                  |               |-- SET refresh:{userId} -->|
  |<-- 200 {tokens}--|               |                           |
```

### Diagram 5: Report Generation Flow

```
User        ReportController    ReportService    AttendanceModel    PdfGenerator/ExcelGenerator
  |               |                  |                  |                    |
  |-- GET /report>|                  |                  |                    |
  |               |-- validateScope->|                  |                    |
  |               |                 |-- aggregatePipeline -->|               |
  |               |                 |<-- ReportRow[] --------|               |
  |               |                 |-- route by format ---------------------->|
  |               |                 |<-- Buffer (PDF/Excel) ------------------|
  |<-- 200 file --|                  |                  |                    |
```

### Diagram 6: Logout + Token Blacklist

```
Client          AuthController    AuthService       Redis
  |                  |                |               |
  |-- POST /logout ->|                |               |
  |  Authorization: Bearer {token}    |               |
  |                  |-- logout() --->|               |
  |                  |               |-- SET blacklist:{jti} TTL=remaining -->|
  |                  |               |-- DEL refresh:{userId} --------------->|
  |<-- 200 OK -------|               |               |
```

---

## Data Flow Diagram

```
[Admin]
  |
  +-- Creates Users ---------> [users collection]
  |                                    |
  +-- Creates Subjects ------> [subjects collection]
  |                                    |
  +-- Assigns Faculty -------> [subjects.facultyIds]
  |                                    |
  +-- Enrolls Students ------> [subjects.studentIds]
  |
[Faculty]
  |
  +-- Marks Attendance ------> [attendance collection]
  |                                    |
  +-- Bulk Upload CSV -------> [attendance collection]
  |                                    |
  |                            [AttendanceService.calcPercentage()]
  |                                    |
  |                            [AlertService.checkAndAlert()]
  |                                    |
  |                            [notifications collection] + [Email]
  |
  +-- Generates Reports -----> [MongoDB Aggregation] --> [PDF/Excel Buffer]
  |
[Student]
  |
  +-- Views Dashboard -------> [attendance collection] (own records)
  |
  +-- Views Notifications ---> [notifications collection] (own records)
  |
  +-- Downloads Report ------> [ReportService] (own data only)
```

---

## Security Boundaries Summary

| Boundary | Enforcement Point | Mechanism |
|---|---|---|
| Authentication | `authMiddleware` on all protected routes | JWT verification + Redis blacklist |
| Role Authorization | `authorize(roles[])` middleware | Role check from JWT payload |
| Object-Level (IDOR) | Service layer before DB query | userId comparison in service methods |
| Faculty-Subject Ownership | `AttendanceService`, `ReportService` | SubjectService.getSubjectById() + facultyIds check |
| Student Data Isolation | `UserService`, `AttendanceService`, `NotificationService`, `ReportService` | userId === requesterId check |
| Admin-Only Mutations | `authorize(['admin'])` on mutation routes | Role middleware |
| Rate Limiting | Nginx + `express-rate-limit` (Redis store) | Per-IP and per-user limits |
| Input Validation | `validateBody/Query/Params` middleware | Joi schema validation before controller |
| Token Blacklist | `authMiddleware` → Redis lookup | `blacklist:{jti}` key check |
