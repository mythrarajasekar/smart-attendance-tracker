# Code Summary — Unit 3: Subject Management

## Backend Files Generated

| File | Path | Purpose |
|---|---|---|
| subject.model.ts | src/modules/subjects/ | Subject schema with audit log, 7 compound indexes |
| subject.validation.ts | src/modules/subjects/ | Joi schemas: create, update, assignFaculty, enrollStudents, search |
| subject.service.ts | src/modules/subjects/ | Business logic: CRUD, faculty assignment, enrollment, bulk CSV, cache |
| subject.controller.ts | src/modules/subjects/ | 11 route handlers |
| subject.routes.ts | src/modules/subjects/ | Router with CSV multer, authenticate, authorize |

## Frontend Files Generated

| File | Path | Purpose |
|---|---|---|
| subjectSlice.ts | src/frontend/features/subjects/store/ | Redux state + 10 async thunks |
| SubjectList.tsx | src/frontend/features/subjects/components/ | Paginated subject list with filters |
| SubjectForm.tsx | src/frontend/features/subjects/components/ | Create/edit subject form |
| EnrollmentManager.tsx | src/frontend/features/subjects/components/ | Single + bulk CSV enrollment |
| FacultySubjects.tsx | src/frontend/features/subjects/components/ | Faculty assigned subjects view |

## Test Files Generated

| File | Type | Coverage |
|---|---|---|
| subject.service.test.ts | Unit | createSubject, enrollStudents (capacity, idempotency, inactive), getSubjectById (IDOR) |
| subject.pbt.test.ts | PBT (fast-check) | Enrollment totals invariant, $addToSet idempotency, capacity invariant, code uppercase idempotency, pagination invariant |
| subject.integration.test.ts | Integration | POST /subjects (admin/non-admin/validation), GET /subjects, duplicate code |

## Security Compliance (Unit 3)

| SECURITY Rule | Status | Implementation |
|---|---|---|
| SECURITY-05 (Input validation) | Compliant | Joi schemas on all endpoints |
| SECURITY-06 (Least privilege) | Compliant | Admin-only mutations, role-scoped reads |
| SECURITY-08 (Access control) | Compliant | Faculty/student IDOR prevention in service layer |
| SECURITY-09 (Hardening) | Compliant | auditLog never in responses, CSV MIME validation |

## PBT Compliance (Partial Mode)

| PBT Rule | Status | Tests |
|---|---|---|
| PBT-02 (Round-trip) | Compliant | Code uppercase idempotency |
| PBT-03 (Invariants) | Compliant | Enrollment totals, capacity, pagination, $addToSet idempotency |
| PBT-07 (Generator quality) | Compliant | Domain generators: uuid, integer ranges |
| PBT-08 (Shrinking) | Compliant | fast-check default shrinking |
| PBT-09 (Framework) | Compliant | fast-check 3.x with Jest |
