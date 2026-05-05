# Business Rules — Unit 5: Reporting Engine

| ID | Rule | Enforcement |
|---|---|---|
| BR-RPT-01 | Students can only view and download their own reports | studentId === requesterId check |
| BR-RPT-02 | Faculty can only generate reports for their assigned subjects | facultyIds check in service |
| BR-RPT-03 | Admin can generate any report (student, subject, department, institution) | authorize(['admin']) |
| BR-RPT-04 | Reports are generated on-demand (not pre-stored) — immutable snapshots | No report storage in DB |
| BR-RPT-05 | Every report export is audited (logged to Winston with full context) | Audit log in every generator function |
| BR-RPT-06 | Report data is scoped to the requested month and year | $match with monthStart/monthEnd |
| BR-RPT-07 | Institution reports are paginated (max 100,000 rows per export) | Aggregation with $limit |
| BR-RPT-08 | Report totals must be consistent with raw attendance records | Invariant enforced by aggregation pipeline |
| BR-RPT-09 | Low attendance report filters by configurable threshold | threshold param from settings |

## PBT Properties

| Property | Category | Description |
|---|---|---|
| PBT-RPT-01 | Invariant | Report row totals consistent with raw attendance data |
| PBT-RPT-02 | Invariant | percentage in each row always in [0, 100] |
| PBT-RPT-03 | Round-trip | Report data serialization → deserialization preserves all fields |
| PBT-RPT-04 | Invariant | attended <= total in every report row |
