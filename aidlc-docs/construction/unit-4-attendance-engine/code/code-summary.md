# Code Summary — Unit 4: Attendance Engine

## Backend Files Generated

| File | Path | Purpose |
|---|---|---|
| attendance.model.ts | src/modules/attendance/ | AttendanceSession + AttendanceRecord schemas, 9 indexes |
| attendance.validation.ts | src/modules/attendance/ | Joi schemas: mark, edit, lock, query |
| attendance.service.ts | src/modules/attendance/ | Business logic: mark, edit, lock, percentage calc, aggregation |
| attendance.controller.ts | src/modules/attendance/ | 6 route handlers |
| attendance.routes.ts | src/modules/attendance/ | Router with role-based access |
| attendance.jobs.ts | src/modules/attendance/ | Nightly recalculation cron job (node-cron) |

## Frontend Files Generated

| File | Path | Purpose |
|---|---|---|
| attendanceSlice.ts | src/frontend/features/attendance/store/ | Redux state + 6 async thunks |
| AttendanceSheet.tsx | src/frontend/features/attendance/components/ | Per-student toggle sheet with lock |
| AttendanceHistory.tsx | src/frontend/features/attendance/components/ | Student attendance history table |
| AttendanceAnalytics.tsx | src/frontend/features/attendance/components/ | Subject-wise percentage analytics |
| FacultyAttendancePage.tsx | src/frontend/features/attendance/components/ | Tabbed faculty attendance management |

## Test Files Generated

| File | Type | Coverage |
|---|---|---|
| attendance.service.test.ts | Unit | markAttendance (auth, lock, success), calculatePercentage (cache, zero, aggregation), editRecord (window) |
| attendance.pbt.test.ts | PBT (fast-check) | 6 properties: range [0,100], attended<=total, zero-total, idempotency, precision, sessionId determinism |
| attendance.integration.test.ts | Integration | POST /attendance (student forbidden, faculty success, future date), GET /student history |

## PBT Compliance (Partial Mode)

| PBT Rule | Status | Tests |
|---|---|---|
| PBT-02 (Round-trip) | Compliant | SessionId determinism (same inputs → same output) |
| PBT-03 (Invariants) | Compliant | Percentage range, attended<=total, zero-total, precision |
| PBT-04 (Idempotency) | Compliant | Marking same student twice yields same percentage |
| PBT-07 (Generator quality) | Compliant | Domain generators: integer ranges, uuid, date, constantFrom |
| PBT-08 (Shrinking) | Compliant | fast-check default shrinking |
| PBT-09 (Framework) | Compliant | fast-check 3.x with Jest |
