# NFR Requirements — Unit 6: Alert & Notification System

## Performance Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-NOTIF-PERF-01 | Alert trigger (in-app creation + Redis dedup) | p95 < 100ms |
| NFR-NOTIF-PERF-02 | Email enqueue (async, non-blocking) | p95 < 10ms |
| NFR-NOTIF-PERF-03 | Notification list fetch | p95 < 100ms |
| NFR-NOTIF-PERF-04 | Mark as read | p95 < 50ms |

## Scalability Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-NOTIF-SCALE-01 | Email queue throughput | 10,000 emails/day |
| NFR-NOTIF-SCALE-02 | Concurrent alert triggers | 100 simultaneous |
| NFR-NOTIF-SCALE-03 | Notification delivery success rate | > 99% (with retries) |

## Reliability Requirements

| ID | Requirement |
|---|---|
| NFR-NOTIF-REL-01 | Email queue is in-memory (Bull/BullMQ) — acceptable for v1; upgrade to Redis-backed queue for production |
| NFR-NOTIF-REL-02 | Email provider failover: primary SendGrid, fallback AWS SES (configurable via EMAIL_PROVIDER env var) |
| NFR-NOTIF-REL-03 | Dead-letter notifications logged to Winston for manual review |
| NFR-NOTIF-REL-04 | Redis deduplication failure is non-blocking (alert still created, duplicate possible) |

## Security Requirements

| ID | Requirement |
|---|---|
| NFR-NOTIF-SEC-01 | Students access only their own notifications (IDOR prevention) |
| NFR-NOTIF-SEC-02 | Email templates sanitized — no user-controlled HTML injection |
| NFR-NOTIF-SEC-03 | Email provider credentials stored in secrets manager (never hardcoded) |
