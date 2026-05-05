# Frontend Components — Unit 2: User & Profile Management

## Component Hierarchy

```
features/users/
  pages/
    StudentProfilePage       → wraps StudentProfile + photo upload
    FacultyProfilePage       → wraps FacultyProfile + photo upload
    AdminUserManagementPage  → wraps AdminUserManagement
  components/
    StudentProfile           → view/edit student profile form
    FacultyProfile           → view/edit faculty profile form
    AdminUserManagement      → user list + create/edit/deactivate
    UserTable                → reusable paginated sortable table
    SearchFilters            → role/department/status filter bar
    UserFormModal            → create/edit user modal (admin)
    PhotoUpload              → avatar upload with preview
  store/
    userSlice.ts             → Redux state for user profiles
```

## Component: StudentProfile

**File**: `src/frontend/features/users/components/StudentProfile.tsx`

**Props**: `{ userId: string; readOnly?: boolean }`

**State (Redux)**: `users.currentProfile`

**Editable fields**: name, phone, parentContact, yearSemester, profilePhoto

**Read-only fields** (displayed but not editable): rollNumber, department, academicYear, email, role

**data-testid attributes**:
```
student-profile-form
student-profile-name-input
student-profile-phone-input
student-profile-parent-contact-input
student-profile-year-semester-input
student-profile-save-button
student-profile-photo-upload
student-profile-roll-number-display
student-profile-department-display
```

---

## Component: FacultyProfile

**File**: `src/frontend/features/users/components/FacultyProfile.tsx`

**Props**: `{ userId: string; readOnly?: boolean }`

**Editable fields**: name, phone, designation, profilePhoto

**Read-only fields**: employeeId, department, email, role

**data-testid attributes**:
```
faculty-profile-form
faculty-profile-name-input
faculty-profile-phone-input
faculty-profile-designation-input
faculty-profile-save-button
faculty-profile-photo-upload
faculty-profile-employee-id-display
faculty-profile-department-display
```

---

## Component: AdminUserManagement

**File**: `src/frontend/features/users/components/AdminUserManagement.tsx`

**Purpose**: Full user management panel for admins — list, search, create, edit, deactivate.

**Sub-components**: SearchFilters, UserTable, UserFormModal

**State (Redux)**: `users.list`, `users.pagination`, `users.filters`

**data-testid attributes**:
```
admin-user-management
admin-create-user-button
admin-user-table
admin-user-search-input
```

---

## Component: UserTable

**File**: `src/frontend/features/users/components/UserTable.tsx`

**Props**:
```typescript
interface UserTableProps {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSort: (field: string, order: 'asc' | 'desc') => void;
  onEdit: (userId: string) => void;
  onDeactivate: (userId: string) => void;
}
```

**Columns**: Name, Email, Role, Department, Status (Active/Inactive), Actions (Edit, Deactivate)

**data-testid attributes**:
```
user-table
user-table-row-{userId}
user-table-edit-{userId}
user-table-deactivate-{userId}
user-table-pagination-prev
user-table-pagination-next
user-table-page-info
```

---

## Component: SearchFilters

**File**: `src/frontend/features/users/components/SearchFilters.tsx`

**Props**:
```typescript
interface SearchFiltersProps {
  filters: UserFilters;
  onChange: (filters: UserFilters) => void;
  onReset: () => void;
}
```

**Filter fields**: search text, role dropdown, department dropdown, status toggle (active/inactive/all)

**data-testid attributes**:
```
search-filters
search-filters-text-input
search-filters-role-select
search-filters-department-select
search-filters-status-select
search-filters-reset-button
```

---

## Redux User Slice

**File**: `src/frontend/features/users/store/userSlice.ts`

**State Shape**:
```typescript
interface UsersState {
  currentProfile: UserProfile | null;
  list: UserProfile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: UserFilters;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}
```

**Async Thunks**:
```typescript
fetchMyProfile()                    → GET /api/v1/users/me
updateMyProfile(data)               → PUT /api/v1/users/me
fetchUsers(query: UserSearchQuery)  → GET /api/v1/users?...
fetchUserById(id)                   → GET /api/v1/users/:id
createUser(data)                    → POST /api/v1/users
updateUser({ id, data })            → PUT /api/v1/users/:id
deactivateUser(id)                  → DELETE /api/v1/users/:id
uploadProfilePhoto(file)            → POST /api/v1/users/me/photo
```
