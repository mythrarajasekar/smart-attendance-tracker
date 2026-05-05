# Frontend Components — Unit 4: Attendance Engine

## Component Hierarchy

```
features/attendance/
  pages/
    FacultyAttendancePage    → main faculty attendance workflow
  components/
    AttendanceSheet          → per-session mark/edit grid
    AttendanceHistory        → student attendance history table
    AttendanceAnalytics      → percentage charts and low-attendance highlights
  store/
    attendanceSlice.ts       → Redux state for attendance
```

## Component: FacultyAttendancePage

**File**: `src/frontend/features/attendance/pages/FacultyAttendancePage.tsx`

**Purpose**: Full faculty attendance workflow — select subject, date, slot → mark attendance → lock session.

**data-testid attributes**:
```
faculty-attendance-page
faculty-attendance-subject-select
faculty-attendance-date-input
faculty-attendance-slot-select
faculty-attendance-load-button
faculty-attendance-lock-button
faculty-attendance-submit-button
```

---

## Component: AttendanceSheet

**File**: `src/frontend/features/attendance/components/AttendanceSheet.tsx`

**Props**:
```typescript
interface AttendanceSheetProps {
  subjectId: string;
  date: string;
  slot: string;
  isLocked: boolean;
  onSubmit: (records: AttendanceRecord[]) => void;
}
```

**Purpose**: Grid of students with present/absent toggles. Shows locked state. Supports bulk mark-all-present/absent.

**data-testid attributes**:
```
attendance-sheet
attendance-sheet-mark-all-present
attendance-sheet-mark-all-absent
attendance-sheet-student-row-{studentId}
attendance-sheet-toggle-{studentId}
attendance-sheet-status-{studentId}
attendance-sheet-locked-badge
```

---

## Component: AttendanceHistory

**File**: `src/frontend/features/attendance/components/AttendanceHistory.tsx`

**Props**: `{ studentId: string; subjectId?: string }`

**Purpose**: Student's attendance history with date, subject, status, and percentage summary.

**data-testid attributes**:
```
attendance-history
attendance-history-subject-filter
attendance-history-month-filter
attendance-history-row-{attendanceId}
attendance-history-status-{attendanceId}
attendance-history-percentage-{subjectId}
```

---

## Component: AttendanceAnalytics

**File**: `src/frontend/features/attendance/components/AttendanceAnalytics.tsx`

**Props**: `{ subjectId?: string; studentId?: string }`

**Purpose**: Displays attendance percentages per subject, highlights students/subjects below threshold, monthly trend.

**data-testid attributes**:
```
attendance-analytics
attendance-analytics-subject-{subjectId}
attendance-analytics-percentage-{subjectId}
attendance-analytics-low-alert-{subjectId}
attendance-analytics-monthly-chart
```

---

## Redux Attendance Slice

**File**: `src/frontend/features/attendance/store/attendanceSlice.ts`

**State Shape**:
```typescript
interface AttendanceState {
  sessionStudents: StudentAttendanceRow[];
  sessionInfo: AttendanceSession | null;
  history: AttendanceRecord[];
  percentages: Record<string, AttendancePercentage>;  // key: "{studentId}:{subjectId}"
  monthlyData: MonthlyAttendanceSummary[];
  pagination: PaginationMeta;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}
```

**Async Thunks**:
```typescript
loadSessionStudents({ subjectId, date, slot })  → GET /api/v1/subjects/:id/students + existing records
markAttendance(BulkMarkRequest)                 → POST /api/v1/attendance
editAttendance({ id, status, reason })          → PUT /api/v1/attendance/:id
lockSession(sessionId)                          → POST /api/v1/attendance/sessions/:id/lock
fetchMyAttendance({ subjectId?, month?, year? }) → GET /api/v1/attendance/student/me
fetchSubjectPercentages(subjectId)              → GET /api/v1/attendance/subject/:id/percentages
fetchMonthlyData({ month, year })               → GET /api/v1/attendance/monthly
```
