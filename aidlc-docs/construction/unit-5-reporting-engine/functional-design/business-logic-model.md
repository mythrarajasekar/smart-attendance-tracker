# Business Logic Model — Unit 5: Reporting Engine

## 1. Generate Student Monthly Report

```
INPUT: requesterId, requesterRole, studentId, month, year, format

Step 1: Validate access:
        Student: studentId === requesterId
        Admin: unrestricted
        Faculty: not allowed for student reports (403)

Step 2: Check Redis cache → GET report:{studentId}:{month}:{year}
        IF hit → return cached ReportRow[]

Step 3: MongoDB aggregation:
        $match: { studentId, date: { $gte: monthStart, $lte: monthEnd } }
        $group by subjectId: { total: $sum 1, attended: $sum $cond present }
        $lookup: subjects collection for name/code/dept/semester
        $lookup: users collection for student name/rollNumber
        $project: ReportRow shape

Step 4: Cache result → SET report:{studentId}:{month}:{year} EX 3600 (1 hour)

Step 5: Audit log → Winston

Step 6: Route to generator by format:
        pdf   → PdfGenerator.generateStudentReport(rows)
        excel → ExcelGenerator.generateStudentReport(rows)
        csv   → CsvGenerator.generateStudentReport(rows)

Step 7: Return ReportBuffer
```

## 2. Generate Subject Monthly Report

```
INPUT: requesterId, requesterRole, subjectId, month, year, format

Step 1: Validate access:
        Faculty: must be assigned to subject
        Admin: unrestricted

Step 2: Aggregation:
        $match: { subjectId, date: { $gte: monthStart, $lte: monthEnd } }
        $group by studentId: { total, attended }
        $lookup: users for student name/rollNumber
        $project: ReportRow shape
        $sort: { rollNumber: 1 }

Step 3: Cache + audit + generate
```

## 3. Generate Department Report (Admin Only)

```
INPUT: department, month, year, format

Step 1: Find all subjects in department for the month
Step 2: Aggregate attendance across all subjects in department
Step 3: Group by subject, then by student
Step 4: Generate multi-sheet Excel or multi-section PDF
```

## 4. Generate Institution Report (Admin Only)

```
INPUT: month, year, format

Step 1: Aggregate all attendance for the month
Step 2: Group by department → subject → student
Step 3: Include summary statistics: total students, avg percentage, below-threshold count
Step 4: Generate paginated report (max 100,000 rows)
```

## 5. Low Attendance Report

```
INPUT: requesterId, requesterRole, threshold, month, year, format

Step 1: Run subject/institution aggregation
Step 2: Filter: percentage < threshold
Step 3: Sort by percentage ascending
Step 4: Generate report with only below-threshold students
```

## 6. Export Audit

```
Every report generation is logged to Winston with:
  - requestedBy, role, scope, targetId, month, year, format
  - rowCount, generatedAt, durationMs
  - correlationId
```
