# Code Summary — Unit 5: Reporting Engine

## Backend Files Generated

| File | Path | Purpose |
|---|---|---|
| report.validation.ts | src/modules/reports/ | Joi schema for report query params |
| report.service.ts | src/modules/reports/ | Aggregation pipelines, PDF/Excel/CSV generators, cache, audit |
| report.controller.ts | src/modules/reports/ | 2 route handlers (student, subject) |
| report.routes.ts | src/modules/reports/ | Router with role-based access |
| report.jobs.ts | src/modules/reports/ | Weekly cache cleanup cron job |

## Frontend Files Generated

| File | Path | Purpose |
|---|---|---|
| reportSlice.ts | src/frontend/features/reports/store/ | Redux state + download thunks |
| ReportFilters.tsx | src/frontend/features/reports/components/ | Month/year/format selector |
| ExportButtons.tsx | src/frontend/features/reports/components/ | Download trigger with loading state |
| StudentReports.tsx | src/frontend/features/reports/components/ | Student self-service report page |
| FacultyReports.tsx | src/frontend/features/reports/components/ | Faculty subject report page |
| AdminReports.tsx | src/frontend/features/reports/components/ | Admin multi-scope report page |

## Test Files Generated

| File | Type | Coverage |
|---|---|---|
| report.service.test.ts | Unit | IDOR prevention, NotFoundError, CSV generation, cache hit |
| report.pbt.test.ts | PBT (fast-check) | Row totals invariant, percentage range, CSV round-trip, month range |
