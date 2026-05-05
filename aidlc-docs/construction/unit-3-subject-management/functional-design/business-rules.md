# Business Rules — Unit 3: Subject Management

## Access Control Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-SUBJ-01 | Only Admin can create subjects | authorize(['admin']) |
| BR-SUBJ-02 | Only Admin can update subject metadata | authorize(['admin']) |
| BR-SUBJ-03 | Only Admin can assign/remove faculty | authorize(['admin']) |
| BR-SUBJ-04 | Only Admin can enroll/unenroll students | authorize(['admin']) |
| BR-SUBJ-05 | Only Admin can deactivate/reactivate subjects | authorize(['admin']) |
| BR-SUBJ-06 | Faculty can only view subjects they are assigned to | facultyIds contains userId check in service |
| BR-SUBJ-07 | Students can only view subjects they are enrolled in | studentIds contains userId check in service |
| BR-SUBJ-08 | Faculty can view enrolled student list for their subjects | facultyIds check before returning studentIds |

## Data Integrity Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-SUBJ-09 | Subject code must be unique within an academic year | Compound unique index { code, academicYear } |
| BR-SUBJ-10 | Subject code is stored and compared in uppercase | code.toUpperCase() on create and search |
| BR-SUBJ-11 | Deletion is always soft (isActive: false) — no hard deletes | No Model.deleteOne() — only findByIdAndUpdate |
| BR-SUBJ-12 | Enrolling an already-enrolled student is idempotent (no error) | $addToSet semantics |
| BR-SUBJ-13 | Assigning an already-assigned faculty is idempotent | $addToSet semantics |
| BR-SUBJ-14 | A subject with capacity null has unlimited enrollment | capacity === null → skip capacity check |
| BR-SUBJ-15 | Enrollment beyond capacity is rejected with CAPACITY_EXCEEDED | currentCount + newCount > capacity → reject excess |
| BR-SUBJ-16 | Deactivated subjects cannot accept new enrollments | isActive check before enrollment |
| BR-SUBJ-17 | Subject code format: alphanumeric + hyphen, max 20 chars, uppercase | Joi + toUpperCase() |

## Bulk CSV Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-SUBJ-18 | CSV must have a rollNumber column | csv-parse column validation |
| BR-SUBJ-19 | Maximum 1000 rows per bulk upload | Row counter during streaming parse |
| BR-SUBJ-20 | Roll numbers not found in DB are reported as errors, not failures | Per-row error in BulkEnrollmentResult |
| BR-SUBJ-21 | Duplicate roll numbers in CSV are deduplicated before processing | Set deduplication before DB lookup |

## Audit Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-SUBJ-22 | Every subject creation is logged | auditLog: [{ action: 'created' }] on create |
| BR-SUBJ-23 | Every faculty assignment/removal is logged | $push auditLog on each operation |
| BR-SUBJ-24 | Every enrollment/unenrollment is logged | $push auditLog with count |
| BR-SUBJ-25 | Audit log is never returned in API responses | select('-auditLog') on all queries |
| BR-SUBJ-26 | Audit log is append-only | $push only, no $pull on auditLog |

## PBT Properties (Partial Mode)

| Property | Category | Description |
|---|---|---|
| PBT-SUBJ-01 | Invariant | studentIds.length never exceeds capacity (when capacity is set) |
| PBT-SUBJ-02 | Idempotency | Enrolling same student twice results in same studentIds array |
| PBT-SUBJ-03 | Invariant | $addToSet never creates duplicates in facultyIds or studentIds |
| PBT-SUBJ-04 | Invariant | EnrollmentResult.enrolled + alreadyEnrolled + capacityExceeded + notFound = input count |
| PBT-SUBJ-05 | Round-trip | Subject code toUpperCase is idempotent: toUpperCase(toUpperCase(x)) = toUpperCase(x) |
