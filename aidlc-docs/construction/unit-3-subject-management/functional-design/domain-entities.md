# Domain Entities — Unit 3: Subject Management

## Subject Entity

```typescript
interface ISubject {
  _id: ObjectId;
  name: string;               // e.g. "Data Structures and Algorithms"
  code: string;               // e.g. "CS301" — unique within academicYear
  department: string;         // e.g. "Computer Science"
  semester: string;           // e.g. "3rd Sem"
  academicYear: string;       // e.g. "2024-2025" — pattern: YYYY-YYYY
  credits: number;            // e.g. 4
  capacity: number | null;    // max enrolled students; null = unlimited
  isActive: boolean;          // soft-delete / deactivation flag
  collegeId: ObjectId | null; // multi-tenancy extensibility hook

  // Assignments (arrays of ObjectId references)
  facultyIds: ObjectId[];     // assigned faculty members
  studentIds: ObjectId[];     // enrolled students

  // Audit
  auditLog: SubjectAuditEntry[];  // select: false

  createdBy: ObjectId;        // admin who created
  createdAt: Date;
  updatedAt: Date;
}
```

## Subject Audit Entry

```typescript
interface SubjectAuditEntry {
  changedBy: ObjectId;
  changedAt: Date;
  action: 'created' | 'updated' | 'deactivated' | 'reactivated'
        | 'faculty_assigned' | 'faculty_removed'
        | 'student_enrolled' | 'student_unenrolled'
        | 'bulk_enrolled';
  details: Record<string, unknown>; // e.g. { facultyId }, { studentIds: [...] }
}
```

## Enrollment Result

```typescript
interface EnrollmentResult {
  enrolled: number;           // newly enrolled
  alreadyEnrolled: number;    // skipped (idempotent)
  capacityExceeded: number;   // rejected due to capacity
  notFound: number;           // studentId not found in DB
  failed: Array<{ studentId: string; reason: string }>;
}
```

## Bulk CSV Row

```typescript
interface BulkEnrollmentRow {
  rollNumber: string;         // used to look up studentId
  row: number;                // 1-based row number for error reporting
}
```

## Subject Search Query

```typescript
interface SubjectSearchQuery {
  department?: string;
  semester?: string;
  academicYear?: string;
  isActive?: boolean;
  search?: string;            // name or code
  page: number;
  limit: number;
  sortBy?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
```

## Department Mapping

```
Departments are stored as strings on Subject documents.
No separate Department collection in v1.
Validated against a configurable list in Settings (future).
Current supported departments (configurable):
  - Computer Science
  - Electronics
  - Mechanical
  - Civil
  - Mathematics
  - Physics
  - Chemistry
```

## Semester Schema

```
Semesters are stored as strings on Subject documents.
Format: "{N}th Sem" or "{N}st Sem" / "{N}nd Sem" / "{N}rd Sem"
Examples: "1st Sem", "2nd Sem", "3rd Sem", "4th Sem", "5th Sem", "6th Sem"
Validated by Joi pattern: /^\d+(st|nd|rd|th)\s[Ss]em$/
```
