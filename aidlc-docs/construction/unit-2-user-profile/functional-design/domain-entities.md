# Domain Entities — Unit 2: User & Profile Management

## Base User Entity (shared fields across all roles)

```typescript
interface BaseUser {
  _id: ObjectId;
  email: string;              // unique, lowercase, trimmed
  passwordHash: string;       // bcrypt, select: false
  role: 'student' | 'faculty' | 'admin';
  name: string;
  isActive: boolean;          // soft-delete flag
  collegeId: ObjectId | null; // multi-tenancy hook
  __v: number;                // Mongoose version key for optimistic concurrency
  createdAt: Date;
  updatedAt: Date;
}
```

## Student Profile Entity

```typescript
interface StudentProfile extends BaseUser {
  role: 'student';
  rollNumber: string;         // unique, immutable after creation
  department: string;         // immutable after creation (admin-managed)
  yearSemester: string;       // e.g. "3rd Sem", "2nd Year"
  academicYear: string;       // e.g. "2024-2025"
  profilePhotoUrl: string | null;   // S3-compatible URL
  profilePhotoKey: string | null;   // S3 object key for deletion
  phone: string | null;
  parentContact: string | null;
}
```

## Faculty Profile Entity

```typescript
interface FacultyProfile extends BaseUser {
  role: 'faculty';
  employeeId: string;         // unique, immutable after creation
  department: string;
  designation: string | null; // e.g. "Assistant Professor"
  profilePhotoUrl: string | null;
  profilePhotoKey: string | null;
  phone: string | null;
}
```

## Admin Profile Entity

```typescript
interface AdminProfile extends BaseUser {
  role: 'admin';
  // Admins have base fields only — no role-specific profile fields
}
```

## Audit Log Entry (embedded in user document)

```typescript
interface ProfileAuditEntry {
  changedBy: ObjectId;        // userId who made the change
  changedAt: Date;
  action: 'created' | 'updated' | 'deactivated' | 'reactivated' | 'photo_uploaded' | 'photo_deleted';
  fields: string[];           // list of field names changed
  previousValues: Record<string, unknown>; // snapshot of changed fields before update
}
```

## Search / Pagination Model

```typescript
interface UserSearchQuery {
  role?: 'student' | 'faculty' | 'admin';
  department?: string;
  academicYear?: string;      // student filter
  isActive?: boolean;
  search?: string;            // full-text search on name, email, rollNumber, employeeId
  page: number;               // 1-based
  limit: number;              // max 100
  sortBy?: 'name' | 'email' | 'createdAt' | 'rollNumber';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedUsers {
  data: UserProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

## Department & Academic Year Relationships

```
Department (string enum, managed by Admin):
  - Stored as a string on User documents
  - No separate collection in v1 (extensibility: future Department collection)
  - Validated against a configurable list in Settings

Academic Year (string, pattern: YYYY-YYYY):
  - Stored on StudentProfile
  - Used for filtering and report scoping
  - Example: "2024-2025"

Year/Semester (string, free-form with validation):
  - Stored on StudentProfile
  - Examples: "1st Year", "2nd Sem", "3rd Year"
```
