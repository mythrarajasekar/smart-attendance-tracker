# Requirements Document — Smart Attendance Tracker

## Intent Analysis Summary

| Field | Value |
|---|---|
| **User Request** | Build a web application for colleges where faculty can mark attendance and students can track their attendance percentage |
| **Request Type** | New Project (Greenfield) |
| **Scope Estimate** | System-wide — full-stack web application with multiple user roles, modules, and integrations |
| **Complexity Estimate** | Complex — multiple user roles, business logic (attendance calculation, alerts), reporting, and security requirements |

---

## 1. Project Overview

The Smart Attendance Tracker is a production-grade web application for colleges that enables faculty to mark student attendance and allows students to monitor their attendance percentage in real time. The system supports three user roles (Student, Faculty, Admin), provides automated low-attendance alerts, and generates downloadable monthly reports.

---

## 2. Functional Requirements

### 2.1 Authentication & Authorization

| ID | Requirement |
|---|---|
| FR-AUTH-01 | The system SHALL support three roles: Student, Faculty, and Admin (separate admin panel) |
| FR-AUTH-02 | Authentication SHALL use JWT with Refresh Token rotation |
| FR-AUTH-03 | Access tokens SHALL have a short expiry; refresh tokens SHALL be rotated on each use |
| FR-AUTH-04 | All routes SHALL require authentication unless explicitly marked public |
| FR-AUTH-05 | Role-based access control SHALL be enforced server-side on every request |
| FR-AUTH-06 | Login endpoints SHALL implement brute-force protection (account lockout after repeated failures) |
| FR-AUTH-07 | Sessions SHALL be invalidated on logout |

### 2.2 User & Profile Management

| ID | Requirement |
|---|---|
| FR-PROF-01 | Student profiles SHALL store: Name, Roll Number, Email, Department, Year/Semester, Profile Photo, Phone Number, and Parent Contact |
| FR-PROF-02 | Faculty profiles SHALL store: Name, Employee ID, Email, Department, and assigned subjects |
| FR-PROF-03 | Admin SHALL be able to create, update, and deactivate user accounts |
| FR-PROF-04 | Students SHALL be able to view and update their own profile (excluding Roll Number and Department) |

### 2.3 Subject & Enrollment Management

| ID | Requirement |
|---|---|
| FR-SUBJ-01 | Admin SHALL create all subjects and manage all faculty and student assignments |
| FR-SUBJ-02 | Admin SHALL assign faculty members to subjects |
| FR-SUBJ-03 | Admin SHALL enroll students into subjects |
| FR-SUBJ-04 | Each subject SHALL have a name, subject code, department, semester, and assigned faculty |
| FR-SUBJ-05 | A student SHALL be enrolled in one or more subjects per semester |

### 2.4 Attendance Marking

| ID | Requirement |
|---|---|
| FR-ATT-01 | Faculty SHALL mark attendance manually via a per-student present/absent toggle for each class session |
| FR-ATT-02 | Faculty SHALL be able to bulk-upload attendance via CSV/Excel file |
| FR-ATT-03 | Each attendance record SHALL capture: student ID, subject ID, date, session identifier, and status (Present/Absent) |
| FR-ATT-04 | Faculty SHALL be able to edit attendance records for past sessions within a configurable correction window |
| FR-ATT-05 | The system SHALL prevent duplicate attendance records for the same student, subject, and session |

### 2.5 Attendance Percentage Calculation

| ID | Requirement |
|---|---|
| FR-CALC-01 | The system SHALL calculate attendance percentage per student per subject as: (classes attended / total classes held) × 100 |
| FR-CALC-02 | Attendance percentage SHALL be recalculated in real time after each marking event |
| FR-CALC-03 | Students SHALL be able to view their attendance percentage per subject on their dashboard |
| FR-CALC-04 | Faculty SHALL be able to view attendance percentages for all students in their assigned subjects |

### 2.6 Low Attendance Alerts

| ID | Requirement |
|---|---|
| FR-ALERT-01 | The attendance threshold SHALL be configurable globally by Admin only |
| FR-ALERT-02 | The default threshold SHALL be 75% |
| FR-ALERT-03 | When a student's attendance in any subject falls below the configured threshold, the system SHALL trigger an alert |
| FR-ALERT-04 | Alerts SHALL be delivered both in-app (dashboard notification) and via email |
| FR-ALERT-05 | Alert emails SHALL include the student's name, subject name, current percentage, and the configured threshold |
| FR-ALERT-06 | The system SHALL not send duplicate alerts for the same student/subject within a 24-hour window |

### 2.7 Monthly Attendance Reports

| ID | Requirement |
|---|---|
| FR-RPT-01 | The system SHALL generate monthly attendance reports per student, per subject, and per department |
| FR-RPT-02 | Reports SHALL be downloadable in both PDF and Excel/CSV formats |
| FR-RPT-03 | Faculty SHALL be able to generate reports for their assigned subjects |
| FR-RPT-04 | Admin SHALL be able to generate reports for any subject, department, or the entire institution |
| FR-RPT-05 | Students SHALL be able to download their own monthly attendance report |
| FR-RPT-06 | Reports SHALL include: student name, roll number, subject, total classes held, classes attended, and attendance percentage |

### 2.8 Data Retention

| ID | Requirement |
|---|---|
| FR-DATA-01 | Attendance records SHALL be retained for the full academic history (all years) |
| FR-DATA-02 | Historical records SHALL be accessible to Admin and Faculty for reporting purposes |
| FR-DATA-03 | Students SHALL be able to view their own historical attendance records |

---

## 3. Non-Functional Requirements

### 3.1 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js with Redux Toolkit for state management |
| Backend | Node.js + Express.js |
| Database | MongoDB |
| Authentication | JWT + Refresh Token rotation |
| API Style | RESTful API |
| Deployment | Cloud platform (AWS / Azure / GCP) |

### 3.2 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | API response time SHALL be under 500ms for 95% of requests under normal load |
| NFR-PERF-02 | Attendance percentage calculation SHALL complete within 200ms for a single student/subject pair |
| NFR-PERF-03 | Report generation (PDF/Excel) SHALL complete within 10 seconds for monthly reports up to 500 students |

### 3.3 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All data at rest (MongoDB) SHALL be encrypted using managed encryption |
| NFR-SEC-02 | All data in transit SHALL use TLS 1.2+ |
| NFR-SEC-03 | Passwords SHALL be hashed using an adaptive algorithm (bcrypt or Argon2) |
| NFR-SEC-04 | HTTP security headers SHALL be enforced (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) |
| NFR-SEC-05 | All API inputs SHALL be validated and sanitized before processing |
| NFR-SEC-06 | Rate limiting SHALL be applied to all public-facing endpoints |
| NFR-SEC-07 | No secrets or credentials SHALL be hardcoded in source code |
| NFR-SEC-08 | Security extension (Security Baseline) is ENABLED — all SECURITY rules are enforced as blocking constraints |

### 3.4 Scalability & Extensibility

| ID | Requirement |
|---|---|
| NFR-SCALE-01 | The system SHALL be designed for a single college/institution but with extensibility in mind for future multi-tenancy |
| NFR-SCALE-02 | Database schema SHALL include a `collegeId` or `institutionId` field on key collections to support future multi-tenancy without a full schema migration |

### 3.5 Reliability

| ID | Requirement |
|---|---|
| NFR-REL-01 | The system SHALL have structured logging with correlation IDs on all requests |
| NFR-REL-02 | All external calls (DB, email service) SHALL have explicit error handling |
| NFR-REL-03 | The system SHALL have a global error handler that returns safe, generic error messages to clients |

### 3.6 Testing

| ID | Requirement |
|---|---|
| NFR-TEST-01 | Property-Based Testing (PBT) extension is ENABLED in Partial mode — PBT rules enforced for pure functions and serialization round-trips |
| NFR-TEST-02 | The PBT framework SHALL be fast-check (JavaScript/TypeScript) integrated with the project's test runner |
| NFR-TEST-03 | Attendance percentage calculation (FR-CALC-01) SHALL have PBT covering invariants and boundary conditions |
| NFR-TEST-04 | CSV/Excel parsing for bulk upload SHALL have round-trip PBT |
| NFR-TEST-05 | All business-critical paths SHALL have both example-based and property-based tests |

---

## 4. Extension Configuration

| Extension | Enabled | Mode |
|---|---|---|
| Security Baseline | Yes | Full — all SECURITY rules are blocking constraints |
| Property-Based Testing | Yes | Partial — PBT-02, PBT-03, PBT-07, PBT-08, PBT-09 enforced; others advisory |

---

## 5. Constraints & Assumptions

- The system is a web application (no native mobile app in scope)
- Email delivery will use a third-party email service (e.g., SendGrid, AWS SES)
- The college has a single admin who manages all subjects, faculty, and student assignments
- Academic year and semester structure is managed by Admin
- No QR code-based attendance in scope (manual + CSV bulk upload only)
- No SMS notifications in scope (in-app + email only)
- No OAuth/social login in scope (email/password with JWT only)

---

## 6. Key Requirements Summary

- **3 user roles**: Student, Faculty, Admin — each with distinct permissions
- **JWT + Refresh Token** authentication with brute-force protection
- **Admin-managed** subjects, faculty assignments, and student enrollments
- **Dual attendance marking**: manual per-student toggle + CSV/Excel bulk upload
- **Real-time attendance percentage** calculation per student per subject
- **Configurable threshold** (admin-set, default 75%) with in-app + email alerts
- **Monthly reports** downloadable as PDF and Excel/CSV
- **Full academic history** retained indefinitely
- **Cloud deployment** (AWS/Azure/GCP) with TLS, encryption at rest, and security headers
- **Security Baseline** fully enforced; **PBT** enforced in partial mode
- **Single-college** design with multi-tenancy extensibility built into the schema
