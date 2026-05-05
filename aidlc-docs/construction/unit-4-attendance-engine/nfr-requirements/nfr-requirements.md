# NFR Requirements — Unit 4: Attendance Engine

## Performance Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-ATT-PERF-01 | Mark attendance (single session, up to 100 students) | p95 < 300ms |
| NFR-ATT-PERF-02 | Percentage calculation (cache hit) | p95 < 10ms |
| NFR-ATT-PERF-03 | Percentage calculation (cache miss, aggregation) | p95 < 100ms |
| NFR-ATT-PERF-04 | Bulk mark (100 students) | p95 < 2 seconds |
| NFR-ATT-PERF-05 | Edit single record | p95 < 200ms |
| NFR-ATT-PERF-06 | Subject-wise aggregation (paginated) | p95 < 500ms |

## Scalability Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-ATT-SCALE-01 | Total attendance records | 1,000,000 records without index degradation |
| NFR-ATT-SCALE-02 | Concurrent faculty marking | 50 simultaneous faculty sessions |
| NFR-ATT-SCALE-03 | Records per subject per academic year | ~18,000 (100 students × 180 sessions) |

## MongoDB Index Requirements

| ID | Index | Purpose |
|---|---|---|
| NFR-ATT-IDX-01 | `{ sessionId: 1, studentId: 1 }` unique | Duplicate prevention |
| NFR-ATT-IDX-02 | `{ studentId: 1, subjectId: 1 }` | Percentage aggregation |
| NFR-ATT-IDX-03 | `{ subjectId: 1, date: -1 }` | Faculty/admin subject view |
| NFR-ATT-IDX-04 | `{ studentId: 1, date: -1 }` | Student history |
| NFR-ATT-IDX-05 | `{ subjectId: 1, studentId: 1, date: -1 }` | Monthly aggregation |
| NFR-ATT-IDX-06 | `{ attendanceSessionId: 1 }` | Session-based queries |

## Session Index Requirements

| ID | Index | Purpose |
|---|---|---|
| NFR-ATT-IDX-07 | `{ sessionId: 1 }` unique | Session lookup |
| NFR-ATT-IDX-08 | `{ subjectId: 1, date: -1 }` | Faculty session list |
| NFR-ATT-IDX-09 | `{ facultyId: 1, date: -1 }` | Faculty's own sessions |

## Reliability Requirements

| ID | Requirement |
|---|---|
| NFR-ATT-REL-01 | Bulk mark uses MongoDB bulkWrite (upsert) for idempotency |
| NFR-ATT-REL-02 | Percentage cache invalidated on every mark/edit |
| NFR-ATT-REL-03 | Background recalculation job runs nightly to fix cache drift |
| NFR-ATT-REL-04 | Session lock is irreversible (no unlock endpoint) |
| NFR-ATT-REL-05 | Concurrent faculty updates handled by upsert semantics (no lost updates) |
