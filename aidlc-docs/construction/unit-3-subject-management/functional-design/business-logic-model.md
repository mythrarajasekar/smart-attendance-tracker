# Business Logic Model — Unit 3: Subject Management

## 1. Create Subject (Admin Only)

```
INPUT: CreateSubjectDto, adminId

Step 1: Validate unique subject code within academicYear
        SubjectModel.findOne({ code: code.toUpperCase(), academicYear })
        IF exists → throw ConflictError('DUPLICATE_SUBJECT_CODE')

Step 2: Create subject document:
        { ...dto, code: code.toUpperCase(), isActive: true, facultyIds: [], studentIds: [],
          createdBy: adminId, auditLog: [{ action: 'created', changedBy: adminId }] }

Step 3: Invalidate Redis subject list cache → DEL subjects:list:*

Step 4: Return created subject
```

## 2. Assign Faculty to Subject (Admin Only)

```
INPUT: subjectId, facultyId, adminId

Step 1: Load subject → validate exists and isActive
Step 2: Validate facultyId exists and has role 'faculty'
Step 3: Check if already assigned → IF facultyIds includes facultyId → return (idempotent)
Step 4: $addToSet: { facultyIds: facultyId }
        $push: { auditLog: { action: 'faculty_assigned', details: { facultyId } } }
Step 5: Invalidate cache → DEL subjects:{subjectId}
```

## 3. Remove Faculty from Subject (Admin Only)

```
INPUT: subjectId, facultyId, adminId

Step 1: Load subject → validate exists
Step 2: $pull: { facultyIds: facultyId }
        $push: { auditLog: { action: 'faculty_removed', details: { facultyId } } }
Step 3: Invalidate cache
```

## 4. Enroll Students (Admin Only — Single or Batch)

```
INPUT: subjectId, studentIds[], adminId

Step 1: Load subject → validate exists and isActive
Step 2: Check capacity:
        currentCount = subject.studentIds.length
        available = capacity === null ? Infinity : capacity - currentCount
        IF studentIds.length > available → split: enroll available, reject rest

Step 3: For each studentId:
        a. Validate user exists and has role 'student'
        b. Check not already enrolled (idempotent skip)
        c. Collect valid new enrollments

Step 4: Bulk $addToSet using MongoDB bulkWrite:
        { updateOne: { filter: { _id: subjectId }, update: { $addToSet: { studentIds: { $each: validIds } } } } }
        $push: { auditLog: { action: 'student_enrolled', details: { count: validIds.length } } }

Step 5: Invalidate cache → DEL subjects:{subjectId}

Step 6: Return EnrollmentResult { enrolled, alreadyEnrolled, capacityExceeded, notFound, failed }
```

## 5. Bulk Enroll via CSV (Admin Only)

```
INPUT: subjectId, csvBuffer, adminId

Step 1: Stream-parse CSV using csv-parse
        Expected columns: rollNumber (required)
        Max rows: 1000

Step 2: For each row, look up student by rollNumber:
        UserModel.find({ rollNumber: { $in: rollNumbers }, role: 'student' })
        Build map: rollNumber → studentId

Step 3: Identify not-found roll numbers (in CSV but not in DB)

Step 4: Call enrollStudents(subjectId, foundStudentIds, adminId)

Step 5: Return BulkEnrollmentResult with per-row success/failure
```

## 6. Unenroll Student (Admin Only)

```
INPUT: subjectId, studentId, adminId

Step 1: Load subject → validate exists
Step 2: $pull: { studentIds: studentId }
        $push: { auditLog: { action: 'student_unenrolled', details: { studentId } } }
Step 3: Invalidate cache
```

## 7. Deactivate / Reactivate Subject (Admin Only)

```
Deactivate:
  Step 1: Validate subject exists and isActive === true
  Step 2: $set: { isActive: false }
          $push: { auditLog: { action: 'deactivated' } }
  Step 3: Invalidate cache

Reactivate:
  Step 1: Validate subject exists and isActive === false
  Step 2: $set: { isActive: true }
          $push: { auditLog: { action: 'reactivated' } }
  Step 3: Invalidate cache
```

## 8. List Subjects (Role-Scoped)

```
INPUT: userId, role, SubjectSearchQuery

Role scoping:
  Admin:   no filter on facultyIds/studentIds
  Faculty: { facultyIds: userId }
  Student: { studentIds: userId }

Step 1: Build query filter (role scope + search filters)
Step 2: Check Redis cache → GET subjects:list:{hash(query)}
        IF hit → return cached result
Step 3: Execute paginated query with compound index
Step 4: Cache result → SET subjects:list:{hash} EX 60 (1 minute)
Step 5: Return PaginatedSubjects
```

## 9. Get Subject Detail

```
INPUT: subjectId, userId, role

Step 1: Check Redis cache → GET subjects:{subjectId}
        IF hit → validate access (role scope) → return

Step 2: SubjectModel.findById(subjectId).select('-auditLog')
        IF not found → throw NotFoundError

Step 3: Validate access:
        Faculty: subjectId must be in their facultyIds
        Student: subjectId must be in their studentIds
        Admin: unrestricted

Step 4: Cache → SET subjects:{subjectId} EX 300

Step 5: Return subject detail
```
