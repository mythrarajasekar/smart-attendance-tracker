# NFR Requirements — Unit 3: Subject Management

## Performance Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-SUBJ-PERF-01 | Subject fetch by ID (cache hit) | p95 < 10ms |
| NFR-SUBJ-PERF-02 | Subject fetch by ID (cache miss) | p95 < 100ms |
| NFR-SUBJ-PERF-03 | Subject list query (paginated) | p95 < 200ms |
| NFR-SUBJ-PERF-04 | Enrollment query (get enrolled students) | p95 < 200ms |
| NFR-SUBJ-PERF-05 | Single student enrollment | p95 < 150ms |
| NFR-SUBJ-PERF-06 | Bulk enrollment (1000 students) | p95 < 5 seconds |
| NFR-SUBJ-PERF-07 | CSV parse + bulk enrollment (1000 rows) | p95 < 8 seconds |

## Scalability Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-SUBJ-SCALE-01 | Total subjects | 500 subjects without index degradation |
| NFR-SUBJ-SCALE-02 | Total enrollments | 50,000 student-subject pairs |
| NFR-SUBJ-SCALE-03 | Max students per subject | 500 (enforced by capacity field) |
| NFR-SUBJ-SCALE-04 | Bulk import batch size | 1,000 students per CSV upload |
| NFR-SUBJ-SCALE-05 | Concurrent enrollment requests | 50 simultaneous admin operations |

## MongoDB Index Requirements

| ID | Index | Purpose |
|---|---|---|
| NFR-SUBJ-IDX-01 | `{ code: 1, academicYear: 1 }` unique | Duplicate code prevention |
| NFR-SUBJ-IDX-02 | `{ facultyIds: 1, isActive: 1 }` | Faculty subject list queries |
| NFR-SUBJ-IDX-03 | `{ studentIds: 1, isActive: 1 }` | Student enrolled subject queries |
| NFR-SUBJ-IDX-04 | `{ department: 1, semester: 1, isActive: 1 }` | Department/semester filtering |
| NFR-SUBJ-IDX-05 | `{ academicYear: 1, isActive: 1 }` | Academic year scoping |
| NFR-SUBJ-IDX-06 | `{ createdAt: -1 }` | Default sort |
| NFR-SUBJ-IDX-07 | Text index: `{ name: 'text', code: 'text' }` | Subject search |

## Reliability Requirements

| ID | Requirement |
|---|---|
| NFR-SUBJ-REL-01 | Bulk enrollment uses MongoDB bulkWrite for atomicity per batch |
| NFR-SUBJ-REL-02 | CSV streaming parser — does not load entire file into memory |
| NFR-SUBJ-REL-03 | Capacity check is performed before bulk write (not after) |
| NFR-SUBJ-REL-04 | Redis cache miss falls back to MongoDB gracefully |
| NFR-SUBJ-REL-05 | Partial bulk enrollment failure returns per-row error report (does not abort entire batch) |

## Security Requirements

| ID | Requirement |
|---|---|
| NFR-SUBJ-SEC-01 | auditLog never returned in API responses |
| NFR-SUBJ-SEC-02 | Faculty IDOR prevention: service validates facultyIds contains userId |
| NFR-SUBJ-SEC-03 | Student IDOR prevention: service validates studentIds contains userId |
| NFR-SUBJ-SEC-04 | CSV upload: MIME type validation (text/csv only), max 1 MB |
| NFR-SUBJ-SEC-05 | Bulk enrollment: studentIds validated against DB before write |
