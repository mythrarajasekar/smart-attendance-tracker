# NFR Requirements — Unit 5: Reporting Engine

## Performance Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-RPT-PERF-01 | Student monthly report generation (cache miss) | p95 < 5 seconds |
| NFR-RPT-PERF-02 | PDF export | p95 < 3 seconds |
| NFR-RPT-PERF-03 | CSV/Excel export | p95 < 2 seconds |
| NFR-RPT-PERF-04 | Report generation (cache hit) | p95 < 200ms |
| NFR-RPT-PERF-05 | Institution-wide report (100,000 rows) | p95 < 30 seconds (async job) |

## Scalability Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-RPT-SCALE-01 | Max report rows per export | 100,000 rows |
| NFR-RPT-SCALE-02 | Concurrent report requests | 20 simultaneous (larger reports queued) |
| NFR-RPT-SCALE-03 | Report cache TTL | 1 hour (data changes infrequently) |

## MongoDB Aggregation Index Requirements

| ID | Index Used | Query |
|---|---|---|
| NFR-RPT-IDX-01 | `{ studentId, date }` | Student monthly report |
| NFR-RPT-IDX-02 | `{ subjectId, date }` | Subject monthly report |
| NFR-RPT-IDX-03 | `{ subjectId, studentId, date }` | Combined aggregation |

## Security Requirements

| ID | Requirement |
|---|---|
| NFR-RPT-SEC-01 | Students can only request their own reports (IDOR prevention) |
| NFR-RPT-SEC-02 | Faculty scoped to assigned subjects |
| NFR-RPT-SEC-03 | Every export audited with requestedBy, scope, format, rowCount |
| NFR-RPT-SEC-04 | Report buffers not stored on disk — streamed directly to response |

## Reliability Requirements

| ID | Requirement |
|---|---|
| NFR-RPT-REL-01 | Report generation errors return 500 with generic message (no internal details) |
| NFR-RPT-REL-02 | Large reports (>10,000 rows) use streaming aggregation cursor |
| NFR-RPT-REL-03 | Redis cache miss falls back to MongoDB gracefully |
