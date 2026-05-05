# Domain Entities — Unit 4: Attendance Engine

## AttendanceSession Entity

```typescript
interface IAttendanceSession {
  _id: ObjectId;
  subjectId: ObjectId;
  facultyId: ObjectId;          // faculty who created the session
  date: Date;                   // date of the class (date only, no time)
  sessionLabel: string;         // e.g. "Morning", "Afternoon", or "Slot 1"
  sessionId: string;            // unique: `${subjectId}_${date}_${sessionLabel}`
  isLocked: boolean;            // true after submission — no further edits
  lockedAt: Date | null;
  totalStudents: number;        // snapshot at time of marking
  presentCount: number;         // computed on mark/edit
  absentCount: number;          // computed on mark/edit
  collegeId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## AttendanceRecord Entity

```typescript
interface IAttendanceRecord {
  _id: ObjectId;
  sessionId: string;            // FK to AttendanceSession.sessionId
  attendanceSessionId: ObjectId; // FK to AttendanceSession._id
  studentId: ObjectId;
  subjectId: ObjectId;
  facultyId: ObjectId;          // who marked this record
  date: Date;                   // same as session date
  status: 'present' | 'absent';
  markedAt: Date;
  editedAt: Date | null;
  editedBy: ObjectId | null;
  editReason: string | null;
  collegeId: ObjectId | null;
  createdAt: Date;
}
```

## AttendancePercentage (computed — not persisted, cached in Redis)

```typescript
interface AttendancePercentage {
  studentId: string;
  subjectId: string;
  attended: number;             // count of 'present' records
  total: number;                // total sessions held
  percentage: number;           // (attended / total) * 100, 2 decimal places
  belowThreshold: boolean;      // percentage < globalThreshold
  lastUpdated: Date;
}
```

## Attendance History Entry

```typescript
interface AttendanceHistoryEntry {
  date: Date;
  sessionLabel: string;
  subjectName: string;
  subjectCode: string;
  status: 'present' | 'absent';
  isLocked: boolean;
}
```
