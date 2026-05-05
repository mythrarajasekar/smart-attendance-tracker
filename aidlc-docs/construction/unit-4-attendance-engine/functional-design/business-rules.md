# Business Rules — Unit 4: Attendance Engine

## Access Control Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-ATT-01 | Only faculty assigned to a subject can mark attendance | SubjectModel.findOne({ _id, facultyIds: facultyId }) |
| BR-ATT-02 | Faculty can only edit records for their assigned subjects | facultyId check in service |
| BR-ATT-03 | Students can only view their own attendance | studentId === req.user.userId |
| BR-ATT-04 | Admin can view all attendance records | authorize(['admin']) |

## Session Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-ATT-05 | One session per subject per date per sessionLabel | Unique sessionId = `${subjectId}_${date}_${sessionLabel}` |
| BR-ATT-06 | Session locks after explicit faculty submission | isLocked: true after lockSession() |
| BR-ATT-07 | Locked sessions cannot be edited | isLocked check before any edit |
| BR-ATT-08 | Re-marking an unlocked session is idempotent (upsert) | updateOne with upsert: true |

## Record Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-ATT-09 | One attendance record per student per session | Compound unique index { sessionId, studentId } |
| BR-ATT-10 | Attendance can be edited only within 24 hours of marking | now - markedAt <= correctionWindowHours (default 24h) |
| BR-ATT-11 | Edit outside correction window returns HTTP 422 | BusinessRuleError('CORRECTION_WINDOW_EXPIRED') |
| BR-ATT-12 | Edit reason is required when editing a record | Joi validation: editReason required on PUT |
| BR-ATT-13 | Edit history is preserved (editedAt, editedBy, editReason) | Fields set on update, never overwritten |

## Calculation Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-ATT-14 | Percentage = (attended / total) × 100, rounded to 2 decimal places | Math.round((attended/total)*10000)/100 |
| BR-ATT-15 | Percentage is 0 when no sessions have been held (no division by zero) | total === 0 → return 0 |
| BR-ATT-16 | Percentage is always in range [0, 100] | Invariant enforced by formula |
| BR-ATT-17 | attended <= total (invariant) | Enforced by data model (status is present/absent only) |
| BR-ATT-18 | Percentage recalculates automatically after every mark/edit | calculateAndCachePercentage() called post-write |

## Alert Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-ATT-19 | Alert triggers when percentage < global threshold | AlertService.checkAndAlert() post-calculation |
| BR-ATT-20 | Alert deduplication: no duplicate alert within 24h | Redis key: alert:{studentId}:{subjectId} TTL 24h |

## PBT Properties (Partial Mode)

| Property | Category | Description |
|---|---|---|
| PBT-ATT-01 | Invariant | percentage always in [0, 100] for all valid attended/total pairs |
| PBT-ATT-02 | Invariant | attended <= total for all valid inputs |
| PBT-ATT-03 | Invariant | percentage = 0 when total = 0 |
| PBT-ATT-04 | Idempotency | Marking same student present twice yields same percentage as marking once |
| PBT-ATT-05 | Round-trip | Serializing and deserializing attendance records preserves all fields |
