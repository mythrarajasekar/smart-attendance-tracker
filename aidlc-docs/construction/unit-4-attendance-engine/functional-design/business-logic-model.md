# Business Logic Model — Unit 4: Attendance Engine

## 1. Mark Attendance (Faculty — Single Session)

```
INPUT: { subjectId, date, sessionLabel, records: [{ studentId, status }] }, facultyId

Step 1: Validate faculty is assigned to subject
        SubjectModel.findOne({ _id: subjectId, facultyIds: facultyId })
        IF not found → throw AuthorizationError('NOT_SUBJECT_FACULTY')

Step 2: Validate all studentIds are enrolled in subject
        SubjectModel.findOne({ _id: subjectId, studentIds: { $all: studentIds } })

Step 3: Generate sessionId = `${subjectId}_${date.toISOString().split('T')[0]}_${sessionLabel}`

Step 4: Check for existing session
        IF session exists AND isLocked → throw BusinessRuleError('SESSION_LOCKED')
        IF session exists AND NOT locked → allow re-mark (idempotent update)

Step 5: Upsert AttendanceSession:
        { sessionId, subjectId, facultyId, date, sessionLabel, isLocked: false }

Step 6: Bulk upsert AttendanceRecords (idempotent):
        For each { studentId, status }:
          updateOne({ sessionId, studentId }, { $set: { status, markedAt: now, facultyId } }, { upsert: true })

Step 7: Update session counts:
        presentCount = records.filter(r => r.status === 'present').length
        absentCount = records.filter(r => r.status === 'absent').length

Step 8: Recalculate percentages for all affected students:
        For each studentId → calculateAndCachePercentage(studentId, subjectId)

Step 9: Trigger alert check for students below threshold:
        For each studentId → AlertService.checkAndAlert(studentId, subjectId, percentage)

Step 10: Return { sessionId, marked: records.length, presentCount, absentCount }
```

## 2. Edit Attendance Record (Faculty — Within 24h Window)

```
INPUT: recordId, { status, editReason }, facultyId

Step 1: Load record → validate exists
Step 2: Validate faculty owns the subject (record.facultyId === facultyId OR faculty assigned to subject)
Step 3: Load session → validate NOT isLocked
        IF isLocked → throw BusinessRuleError('SESSION_LOCKED')
Step 4: Check edit window:
        now - record.markedAt <= 24 hours (configurable via settings.correctionWindowHours)
        IF outside window → throw BusinessRuleError('CORRECTION_WINDOW_EXPIRED')
Step 5: Update record:
        { status, editedAt: now, editedBy: facultyId, editReason }
Step 6: Recalculate percentage for affected student
Step 7: Trigger alert check
Step 8: Return updated record
```

## 3. Lock Session (Faculty — Explicit Submission)

```
INPUT: sessionId, facultyId

Step 1: Load session → validate exists and facultyId matches
Step 2: IF already locked → return (idempotent)
Step 3: $set: { isLocked: true, lockedAt: now }
Step 4: Return { message: 'Session locked', sessionId }
```

## 4. Attendance Percentage Calculation

```
FORMULA: percentage = (attended / total) * 100
         Rounded to 2 decimal places
         Returns 0 if total === 0 (no division by zero)

INPUT: studentId, subjectId

Step 1: Check Redis cache → GET attendance:pct:{studentId}:{subjectId}
        IF hit → return cached value

Step 2: MongoDB aggregation:
        $match: { studentId, subjectId }
        $group: {
          _id: null,
          total: { $sum: 1 },
          attended: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } }
        }

Step 3: Compute percentage:
        total === 0 → percentage = 0
        else → percentage = Math.round((attended / total) * 10000) / 100

Step 4: Cache result → SET attendance:pct:{studentId}:{subjectId} EX 300

Step 5: Return AttendancePercentage
```

## 5. Subject-Wise Aggregation (Faculty/Admin)

```
INPUT: subjectId, filters: { month?, year?, page, limit }

Step 1: Build match stage:
        { subjectId }
        IF month/year: { date: { $gte: monthStart, $lte: monthEnd } }

Step 2: Aggregation pipeline:
        $match → $group by studentId →
        $project: { studentId, attended, total, percentage }
        $sort: { percentage: 1 } (lowest first for easy identification)
        $skip / $limit for pagination

Step 3: Populate student names via $lookup on users collection

Step 4: Return paginated list with percentage per student
```

## 6. Monthly Aggregation

```
INPUT: studentId, subjectId, month, year

Step 1: $match: { studentId, subjectId, date: { $gte: monthStart, $lte: monthEnd } }
Step 2: $group by date:
        { date, sessions: { $push: { sessionLabel, status } } }
Step 3: $sort: { date: 1 }
Step 4: Return daily breakdown for the month
```

## 7. Low Attendance Detection

```
Triggered after every attendance mark/edit.

Step 1: Get updated percentage for student+subject
Step 2: Read threshold from SettingsService (Redis-cached)
Step 3: IF percentage < threshold:
          AlertService.checkAndAlert(studentId, subjectId, percentage)
        ELSE: no action
```

## 8. Background Recalculation Job

```
Purpose: Recalculate all percentages nightly to fix any cache drift.

Schedule: Daily at 2:00 AM (cron: '0 2 * * *')

Step 1: Find all distinct (studentId, subjectId) pairs in attendance collection
Step 2: For each pair: calculateAndCachePercentage(studentId, subjectId)
Step 3: Log completion with count
```
