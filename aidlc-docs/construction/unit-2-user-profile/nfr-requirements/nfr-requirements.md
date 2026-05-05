# NFR Requirements — Unit 2: User & Profile Management

## Performance Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-USER-PERF-01 | Profile fetch by ID (cache hit) | p95 < 10ms |
| NFR-USER-PERF-02 | Profile fetch by ID (cache miss, MongoDB) | p95 < 100ms |
| NFR-USER-PERF-03 | User search with filters | p95 < 300ms |
| NFR-USER-PERF-04 | Profile update | p95 < 200ms |
| NFR-USER-PERF-05 | User list (paginated, no search) | p95 < 150ms |
| NFR-USER-PERF-06 | Photo upload (2 MB file) | p95 < 3 seconds (S3 upload included) |

## Scalability Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-USER-SCALE-01 | Total users supported | 10,000 users without index degradation |
| NFR-USER-SCALE-02 | Concurrent profile reads | 500 simultaneous requests |
| NFR-USER-SCALE-03 | Search query throughput | 100 RPS |
| NFR-USER-SCALE-04 | Redis profile cache | TTL 5 minutes, eviction policy: allkeys-lru |

## MongoDB Index Requirements

| ID | Index | Purpose |
|---|---|---|
| NFR-USER-IDX-01 | `{ email: 1 }` unique | Login lookup, uniqueness check |
| NFR-USER-IDX-02 | `{ rollNumber: 1 }` sparse unique | Student uniqueness, search |
| NFR-USER-IDX-03 | `{ employeeId: 1 }` sparse unique | Faculty uniqueness, search |
| NFR-USER-IDX-04 | `{ role: 1, isActive: 1 }` | Admin list queries filtered by role + status |
| NFR-USER-IDX-05 | `{ department: 1, role: 1, isActive: 1 }` | Department-scoped queries |
| NFR-USER-IDX-06 | `{ academicYear: 1, role: 1 }` | Student academic year filtering |
| NFR-USER-IDX-07 | Text index: `{ name: 'text', email: 'text', rollNumber: 'text', employeeId: 'text' }` | Full-text search |
| NFR-USER-IDX-08 | `{ createdAt: -1 }` | Default sort for user list |

## Security Requirements

| ID | Requirement |
|---|---|
| NFR-USER-SEC-01 | passwordHash never returned in any API response (select: false) |
| NFR-USER-SEC-02 | auditLog never returned in any API response (select: false by default) |
| NFR-USER-SEC-03 | Profile photo URLs are private — pre-signed S3 URLs or CloudFront signed URLs |
| NFR-USER-SEC-04 | S3 bucket must block public access (SECURITY-09 compliant) |
| NFR-USER-SEC-05 | File upload validated for MIME type and size server-side (not just client-side) |
| NFR-USER-SEC-06 | IDOR prevention: service layer validates userId === req.user.userId for own-profile operations |
| NFR-USER-SEC-07 | Audit log is append-only — no API endpoint allows deletion of audit entries |

## Reliability Requirements

| ID | Requirement |
|---|---|
| NFR-USER-REL-01 | Optimistic concurrency on profile updates (Mongoose __v version key) |
| NFR-USER-REL-02 | S3 upload failure rolls back — user document not updated if S3 fails |
| NFR-USER-REL-03 | Redis cache miss falls back to MongoDB gracefully (no 500 on cache failure) |
| NFR-USER-REL-04 | Pagination never returns negative skip values (page >= 1 enforced by Joi) |
