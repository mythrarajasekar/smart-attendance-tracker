# Requirements Verification Questions — Smart Attendance Tracker

Please answer each question by filling in the letter choice after the `[Answer]:` tag.
If none of the options match your needs, choose the last option (Other/X) and describe your preference.

---

## Question 1: Deployment Environment
Where will this application be deployed?

A) Cloud platform (AWS / Azure / GCP)
B) On-premises / college server
C) Shared hosting / VPS
D) Docker / Kubernetes (self-managed)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2: Authentication Strategy
What authentication mechanism should be used?

A) JWT (JSON Web Tokens) — stateless, suitable for REST APIs
B) Session-based authentication — server-side sessions
C) OAuth 2.0 / Social login (Google, Microsoft)
D) JWT + Refresh Token rotation (recommended for production)
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 3: User Role Granularity
How granular should the role/permission system be?

A) Two roles only: Student and Faculty (simple)
B) Three roles: Student, Faculty, and Admin (separate admin panel)
C) Role-based with permissions: Student, Faculty, HOD, Admin (fine-grained)
D) Faculty IS the Admin — no separate admin role needed
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 4: Attendance Marking Method
How should faculty mark attendance?

A) Manual per-student toggle (present/absent per class session)
B) Bulk upload via CSV/Excel file
C) QR code-based (students scan QR to mark themselves present)
D) Both A and B (manual + bulk upload)
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 5: Attendance Percentage Threshold
What is the minimum attendance percentage threshold for alerts?

A) 75% (standard college requirement)
B) 80% (stricter requirement)
C) Configurable per subject by faculty/admin
D) Configurable globally by admin only
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 6: Low Attendance Alert Delivery
How should low attendance alerts be delivered to students?

A) In-app notification only (dashboard alert)
B) Email notification
C) Both in-app and email
D) SMS notification
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 7: Monthly Attendance Report Format
What format should monthly attendance reports be in?

A) On-screen dashboard view only
B) Downloadable PDF report
C) Downloadable Excel/CSV report
D) Both PDF and Excel/CSV download options
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 8: Subject/Course Management
Who manages subjects and their enrollment?

A) Admin creates subjects; faculty is assigned to subjects; students enroll themselves
B) Admin creates subjects and manages all assignments (faculty + students)
C) Faculty creates their own subjects and manages student enrollment
D) Admin creates subjects; faculty assigns students to their subjects
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 9: Multi-Tenancy (Multiple Colleges)
Should the system support multiple colleges/institutions?

A) Single college/institution only
B) Multi-tenant (multiple colleges, each isolated)
C) Not decided yet — design for single but keep extensibility in mind
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 10: Student Profile Data
What data should be stored in a student profile?

A) Basic: Name, Roll Number, Email, Department, Year/Semester
B) Extended: Basic + Profile photo, Phone number, Parent contact
C) Comprehensive: Extended + Academic history, GPA, Elective choices
D) Minimal: Name, Roll Number, Email only
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 11: API Architecture
What API architecture should be used for the backend?

A) RESTful API (standard, well-understood)
B) GraphQL (flexible queries, good for complex data)
C) REST with WebSockets for real-time notifications
D) REST API only (no real-time features needed)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 12: Frontend State Management
What state management approach should be used in React?

A) React Context API + useReducer (built-in, no extra library)
B) Redux Toolkit (industry standard for complex state)
C) Zustand (lightweight, modern alternative)
D) React Query + Context (server state + local state separation)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 13: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 14: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)
B) Partial — enforce PBT rules only for pure functions and serialization round-trips
C) No — skip all PBT rules (suitable for simple CRUD applications or thin integration layers)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 15: Attendance History & Data Retention
How long should attendance records be retained?

A) Current academic year only
B) Full academic history (all years)
C) Configurable retention period (admin sets it)
D) Indefinitely (no deletion)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---
