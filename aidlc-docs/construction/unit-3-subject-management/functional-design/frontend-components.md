# Frontend Components — Unit 3: Subject Management

## Component Hierarchy

```
features/subjects/
  components/
    SubjectList          → paginated list of subjects (role-scoped)
    SubjectForm          → create/edit subject form (admin)
    EnrollmentManager    → enroll/unenroll students, bulk CSV upload (admin)
    FacultySubjects      → faculty's assigned subjects view
  store/
    subjectSlice.ts      → Redux state for subjects
```

## Component: SubjectList

**File**: `src/frontend/features/subjects/components/SubjectList.tsx`

**Purpose**: Displays paginated, searchable list of subjects. Role-scoped (admin sees all, faculty sees assigned, student sees enrolled).

**data-testid attributes**:
```
subject-list
subject-list-search-input
subject-list-department-filter
subject-list-semester-filter
subject-list-row-{subjectId}
subject-list-create-button       (admin only)
subject-list-edit-{subjectId}    (admin only)
subject-list-deactivate-{subjectId} (admin only)
subject-list-pagination-prev
subject-list-pagination-next
```

---

## Component: SubjectForm

**File**: `src/frontend/features/subjects/components/SubjectForm.tsx`

**Props**: `{ subjectId?: string; onSuccess: () => void }`

**Mode**: Create (no subjectId) or Edit (with subjectId)

**Fields**: name, code, department, semester, academicYear, credits, capacity (optional)

**data-testid attributes**:
```
subject-form
subject-form-name-input
subject-form-code-input
subject-form-department-select
subject-form-semester-select
subject-form-academic-year-input
subject-form-credits-input
subject-form-capacity-input
subject-form-submit-button
subject-form-cancel-button
```

---

## Component: EnrollmentManager

**File**: `src/frontend/features/subjects/components/EnrollmentManager.tsx`

**Props**: `{ subjectId: string }`

**Purpose**: Admin panel to view enrolled students, enroll by ID, unenroll, and bulk-upload CSV.

**data-testid attributes**:
```
enrollment-manager
enrollment-student-id-input
enrollment-enroll-button
enrollment-bulk-upload-input
enrollment-bulk-upload-button
enrollment-student-row-{studentId}
enrollment-unenroll-{studentId}
enrollment-bulk-result
```

---

## Component: FacultySubjects

**File**: `src/frontend/features/subjects/components/FacultySubjects.tsx`

**Purpose**: Faculty view of their assigned subjects with student count and quick-access to attendance marking.

**data-testid attributes**:
```
faculty-subjects
faculty-subject-card-{subjectId}
faculty-subject-mark-attendance-{subjectId}
faculty-subject-view-students-{subjectId}
```

---

## Redux Subject Slice

**File**: `src/frontend/features/subjects/store/subjectSlice.ts`

**State Shape**:
```typescript
interface SubjectsState {
  list: Subject[];
  currentSubject: Subject | null;
  enrolledStudents: UserProfile[];
  pagination: PaginationMeta;
  filters: SubjectFilters;
  isLoading: boolean;
  isSaving: boolean;
  bulkResult: BulkEnrollmentResult | null;
  error: string | null;
}
```

**Async Thunks**:
```typescript
fetchSubjects(filters)                    → GET /api/v1/subjects
fetchSubjectById(id)                      → GET /api/v1/subjects/:id
createSubject(data)                       → POST /api/v1/subjects
updateSubject({ id, data })               → PUT /api/v1/subjects/:id
deactivateSubject(id)                     → DELETE /api/v1/subjects/:id
assignFaculty({ subjectId, facultyId })   → POST /api/v1/subjects/:id/faculty
removeFaculty({ subjectId, facultyId })   → DELETE /api/v1/subjects/:id/faculty/:facultyId
enrollStudents({ subjectId, studentIds }) → POST /api/v1/subjects/:id/students
unenrollStudent({ subjectId, studentId }) → DELETE /api/v1/subjects/:id/students/:studentId
bulkEnrollCSV({ subjectId, file })        → POST /api/v1/subjects/:id/students/bulk
fetchEnrolledStudents(subjectId)          → GET /api/v1/subjects/:id/students
```
