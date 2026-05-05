# Business Rules — Unit 6: Alert & Notification System

| ID | Rule | Enforcement |
|---|---|---|
| BR-NOTIF-01 | Alert triggers when percentage < global threshold | AlertService.checkAndAlert() |
| BR-NOTIF-02 | Duplicate alerts suppressed within 24-hour window | Redis key: alert:{userId}:{subjectId} TTL 86400 |
| BR-NOTIF-03 | Students see only their own notifications | userId === req.user.userId check |
| BR-NOTIF-04 | Email delivery failure does not block in-app notification creation | Email is async, non-blocking |
| BR-NOTIF-05 | Failed emails retry up to 3 times with exponential backoff | emailAttempts counter + retry queue |
| BR-NOTIF-06 | After 3 failed attempts, notification marked 'failed' (dead-letter) | emailStatus: 'failed' |
| BR-NOTIF-07 | All alert triggers are logged to Winston | logger.info('notification.alert.triggered') |
| BR-NOTIF-08 | Notification deletion is hard delete (no soft delete for notifications) | deleteOne() |
| BR-NOTIF-09 | read-all marks all unread notifications for the user | updateMany with userId filter |
| BR-NOTIF-10 | Weekly reminder job re-triggers alerts for persistent low attendance | Cron job with deduplication check |

## PBT Properties

| Property | Category | Description |
|---|---|---|
| PBT-NOTIF-01 | Invariant | Alert never triggered when percentage >= threshold |
| PBT-NOTIF-02 | Idempotency | Triggering alert twice within 24h creates only one notification |
| PBT-NOTIF-03 | Invariant | emailAttempts never exceeds 3 |
| PBT-NOTIF-04 | Invariant | Unread count = notifications where read === false |
