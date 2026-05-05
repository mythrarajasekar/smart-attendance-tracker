# Component Methods — Smart Attendance Tracker

> **Note**: Method signatures define interfaces and input/output contracts.
> Detailed business rule implementations are specified in Functional Design (Construction Phase, per unit).

---

## Auth Service Methods

```typescript
// authService.ts

/**
 * Validates credentials and issues token pair.
 * Increments failed attempt counter in Redis on failure.
 * Locks account after MAX_ATTEMPTS (5) failures.
 */
login(email: string, password: string): Promise<TokenPair>

/**
 * Verifies refresh token from Redis, rotates it (delete old, store new),
 * and returns a new token pair.
 */
refreshTokens(refreshToken: string): Promise<TokenPair>

/**
 * Blacklists the access token and deletes the refresh token from Redis.
 */
logout(userId: string, accessToken: string): Promise<void>

/**
 * Generates a signed JWT access token with 15-minute expiry.
 */
generateAccessToken(payload: JwtPayload): string

/**
 * Generates a signed JWT refresh token with 7-day expiry,
 * stores it in Redis with TTL.
 */
generateRefreshToken(userId: string): Promise<string>

/**
 * Verifies JWT signature and expiry. Checks Redis blacklist.
 * Returns decoded payload or throws AuthError.
 */
verifyAccessToken(token: string): Promise<JwtPayload>

/**
 * Checks if account is locked due to brute-force protection.
 */
isAccountLocked(email: string): Promise<boolean>

/**
 * Resets failed attempt counter after successful login.
 */
resetFailedAttempts(email: string): Promise<void>

// Types
interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface JwtPayload {
  userId: string;
  email: string;
  role: 'student' | 'faculty' | 'admin';
  iat: number;
  exp: number;
}
```

---

## Auth Middleware Methods

```typescript
// authMiddleware.ts

/**
 * Express middleware: extracts Bearer token from Authorization header,
 * verifies it, checks Redis blacklist, attaches req.user.
 * Returns 401 if invalid or expired.
 */
authenticate(): RequestHandler

/**
 * Express middleware factory: checks req.user.role against allowed roles.
 * Returns 403 if role not permitted.
 */
authorize(roles: Role[]): RequestHandler

type Role = 'student' | 'faculty' | 'admin';
```

---

## User Service Methods

```typescript
// userService.ts

/**
 * Creates a new user account. Hashes password with bcrypt.
 * Admin-only operation.
 */
createUser(data: CreateUserDto): Promise<UserDocument>

/**
 * Returns the current authenticated user's profile.
 */
getMyProfile(userId: string): Promise<UserProfile>

/**
 * Updates own profile. Enforces field-level restrictions by role
 * (students cannot modify rollNumber or department).
 */
updateMyProfile(userId: string, role: Role, data: UpdateProfileDto): Promise<UserProfile>

/**
 * Returns a user by ID. Admin-only.
 */
getUserById(userId: string): Promise<UserDocument>

/**
 * Returns paginated list of users, optionally filtered by role.
 * Admin-only.
 */
listUsers(filters: UserFilters, pagination: PaginationOptions): Promise<PaginatedResult<UserDocument>>

/**
 * Updates any user's account data. Admin-only.
 */
updateUser(userId: string, data: AdminUpdateUserDto): Promise<UserDocument>

/**
 * Soft-deactivates a user account (sets isActive: false). Admin-only.
 */
deactivateUser(userId: string): Promise<void>

// Types
interface CreateUserDto {
  email: string;
  password: string;
  role: Role;
  name: string;
  rollNumber?: string;       // Student only
  employeeId?: string;       // Faculty only
  department: string;
  yearSemester?: string;     // Student only
  phone?: string;
  parentContact?: string;    // Student only
}

interface UpdateProfileDto {
  name?: string;
  phone?: string;
  parentContact?: string;    // Student only
  profilePhotoUrl?: string;
}

interface UserFilters {
  role?: Role;
  department?: string;
  isActive?: boolean;
}
```

---

## Subject Service Methods

```typescript
// subjectService.ts

/**
 * Creates a new subject. Admin-only.
 * Includes collegeId for multi-tenancy extensibility.
 */
createSubject(data: CreateSubjectDto): Promise<SubjectDocument>

/**
 * Returns subjects scoped by role:
 * - Admin: all subjects
 * - Faculty: assigned subjects only
 * - Student: enrolled subjects only
 */
listSubjects(userId: string, role: Role, filters: SubjectFilters): Promise<SubjectDocument[]>

/**
 * Returns subject detail with enrolled students and assigned faculty.
 */
getSubjectById(subjectId: string): Promise<SubjectDetail>

/**
 * Updates subject metadata. Admin-only.
 */
updateSubject(subjectId: string, data: UpdateSubjectDto): Promise<SubjectDocument>

/**
 * Deletes a subject. Admin-only. Validates no attendance records exist.
 */
deleteSubject(subjectId: string): Promise<void>

/**
 * Assigns a faculty member to a subject. Admin-only.
 * Validates faculty user exists and has faculty role.
 */
assignFaculty(subjectId: string, facultyId: string): Promise<void>

/**
 * Removes faculty assignment from subject. Admin-only.
 */
removeFaculty(subjectId: string, facultyId: string): Promise<void>

/**
 * Enrolls one or more students in a subject. Admin-only.
 * Idempotent — enrolling already-enrolled student has no effect.
 */
enrollStudents(subjectId: string, studentIds: string[]): Promise<EnrollmentResult>

/**
 * Unenrolls a student from a subject. Admin-only.
 */
unenrollStudent(subjectId: string, studentId: string): Promise<void>

/**
 * Returns paginated list of students enrolled in a subject.
 * Faculty + Admin.
 */
getEnrolledStudents(subjectId: string, pagination: PaginationOptions): Promise<PaginatedResult<UserDocument>>

// Types
interface CreateSubjectDto {
  name: string;
  code: string;
  department: string;
  semester: string;
  academicYear: string;
  collegeId?: string;
}

interface EnrollmentResult {
  enrolled: number;
  alreadyEnrolled: number;
  failed: string[];
}
```

---

## Attendance Service Methods

```typescript
// attendanceService.ts

/**
 * Marks attendance for a list of students in a session.
 * Validates faculty owns the subject.
 * Prevents duplicate records (same student + subject + sessionId).
 * Triggers alert check after marking.
 */
markAttendance(facultyId: string, data: MarkAttendanceDto): Promise<AttendanceMarkResult>

/**
 * Edits an existing attendance record.
 * Validates correction window (configurable, default 48h).
 * Faculty must own the subject.
 */
editAttendance(facultyId: string, recordId: string, status: AttendanceStatus): Promise<AttendanceRecord>

/**
 * Parses CSV/Excel file and bulk-marks attendance.
 * Returns per-row success/failure report.
 */
bulkUploadAttendance(facultyId: string, subjectId: string, file: Buffer, mimeType: string): Promise<BulkUploadResult>

/**
 * Returns all attendance records for a subject, paginated.
 * Faculty + Admin only.
 */
getSubjectAttendance(subjectId: string, filters: AttendanceFilters, pagination: PaginationOptions): Promise<PaginatedResult<AttendanceRecord>>

/**
 * Returns a student's attendance history across all subjects.
 * Student sees own; Admin sees any.
 */
getStudentAttendance(studentId: string, requesterId: string, requesterRole: Role): Promise<AttendanceRecord[]>

/**
 * Calculates attendance percentage for a student in a subject.
 * Formula: (attended / total) * 100, rounded to 2 decimal places.
 * Returns 0 if no classes held.
 */
calculatePercentage(studentId: string, subjectId: string): Promise<AttendancePercentage>

/**
 * Returns attendance percentages for all students in a subject.
 * Faculty + Admin.
 */
getSubjectPercentages(subjectId: string): Promise<AttendancePercentage[]>

// Types
interface MarkAttendanceDto {
  subjectId: string;
  sessionId: string;
  date: Date;
  records: Array<{ studentId: string; status: AttendanceStatus }>;
}

type AttendanceStatus = 'present' | 'absent';

interface AttendancePercentage {
  studentId: string;
  subjectId: string;
  attended: number;
  total: number;
  percentage: number;
}

interface BulkUploadResult {
  total: number;
  success: number;
  duplicates: number;
  errors: Array<{ row: number; reason: string }>;
}
```

---

## Report Service Methods

```typescript
// reportService.ts

/**
 * Generates a monthly attendance report for a student.
 * Student can only request own report; Admin can request any.
 */
generateStudentReport(requesterId: string, requesterRole: Role, studentId: string, month: number, year: number, format: ReportFormat): Promise<ReportBuffer>

/**
 * Generates a monthly attendance report for a subject.
 * Faculty must own the subject; Admin unrestricted.
 */
generateSubjectReport(requesterId: string, requesterRole: Role, subjectId: string, month: number, year: number, format: ReportFormat): Promise<ReportBuffer>

/**
 * Generates a department-wide monthly report. Admin-only.
 */
generateDepartmentReport(department: string, month: number, year: number, format: ReportFormat): Promise<ReportBuffer>

/**
 * Generates institution-wide monthly report. Admin-only.
 */
generateInstitutionReport(month: number, year: number, format: ReportFormat): Promise<ReportBuffer>

/**
 * Aggregates raw attendance data into report rows using MongoDB pipeline.
 */
aggregateAttendanceData(query: ReportQuery): Promise<ReportRow[]>

type ReportFormat = 'pdf' | 'excel' | 'csv';

interface ReportBuffer {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

interface ReportRow {
  studentName: string;
  rollNumber: string;
  subjectName: string;
  subjectCode: string;
  totalClasses: number;
  attended: number;
  percentage: number;
}
```

---

## Notification / Alert Service Methods

```typescript
// alertService.ts

/**
 * Called after each attendance marking event.
 * Checks percentage against global threshold.
 * Skips if percentage >= threshold.
 * Skips if alert already sent within 24h (Redis deduplication).
 * Creates in-app notification and dispatches email.
 */
checkAndAlert(studentId: string, subjectId: string, percentage: number): Promise<void>

/**
 * Checks Redis for existing alert key: alert:{studentId}:{subjectId}
 * Returns true if alert was sent within 24h window.
 */
isDuplicateAlert(studentId: string, subjectId: string): Promise<boolean>

/**
 * Sets Redis deduplication key with 24h TTL.
 */
setAlertSent(studentId: string, subjectId: string): Promise<void>

// notificationService.ts

/**
 * Creates an in-app notification record in MongoDB.
 */
createNotification(data: CreateNotificationDto): Promise<NotificationDocument>

/**
 * Returns paginated notifications for a student (own only).
 */
getNotifications(studentId: string, pagination: PaginationOptions): Promise<PaginatedResult<NotificationDocument>>

/**
 * Marks a notification as read. Validates ownership.
 */
markAsRead(notificationId: string, studentId: string): Promise<void>

/**
 * Marks all notifications as read for a student.
 */
markAllAsRead(studentId: string): Promise<void>

/**
 * Deletes a notification. Validates ownership.
 */
deleteNotification(notificationId: string, studentId: string): Promise<void>

// emailService.ts

/**
 * Sends a low-attendance alert email via SendGrid/SES.
 * Includes student name, subject name, current percentage, threshold.
 */
sendLowAttendanceAlert(data: AlertEmailData): Promise<void>

interface AlertEmailData {
  studentEmail: string;
  studentName: string;
  subjectName: string;
  currentPercentage: number;
  threshold: number;
}
```

---

## Settings Service Methods

```typescript
// settingsService.ts

/**
 * Returns global settings. Reads from Redis cache first, falls back to MongoDB.
 */
getSettings(): Promise<GlobalSettings>

/**
 * Updates the global attendance threshold. Admin-only.
 * Invalidates Redis cache after update.
 */
updateThreshold(threshold: number): Promise<GlobalSettings>

interface GlobalSettings {
  attendanceThreshold: number;   // default: 75
  correctionWindowHours: number; // default: 48
  updatedAt: Date;
  updatedBy: string;
}
```
