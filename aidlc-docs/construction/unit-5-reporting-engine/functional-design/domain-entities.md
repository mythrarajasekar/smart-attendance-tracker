# Domain Entities — Unit 5: Reporting Engine

## ReportRow (computed — not persisted)

```typescript
interface ReportRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  department: string;
  semester: string;
  academicYear: string;
  totalClasses: number;
  attended: number;
  percentage: number;
  month?: number;
  year?: number;
}
```

## ReportRequest

```typescript
interface ReportRequest {
  scope: 'student' | 'subject' | 'department' | 'institution';
  targetId?: string;          // studentId or subjectId (scope-dependent)
  department?: string;        // for department scope
  month: number;              // 1-12
  year: number;               // e.g. 2024
  format: 'pdf' | 'excel' | 'csv';
}
```

## ReportBuffer

```typescript
interface ReportBuffer {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  rowCount: number;
}
```

## ReportAuditEntry (logged to Winston — not persisted in DB)

```typescript
interface ReportAuditEntry {
  requestedBy: string;        // userId
  role: string;
  scope: string;
  targetId?: string;
  month: number;
  year: number;
  format: string;
  rowCount: number;
  generatedAt: Date;
  durationMs: number;
}
```
