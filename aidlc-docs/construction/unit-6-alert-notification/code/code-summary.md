# Code Summary — Unit 6: Alert & Notification System

## Backend Files Generated

| File | Path | Purpose |
|---|---|---|
| notification.model.ts | src/modules/notifications/ | Notification schema with email retry fields, 3 indexes |
| notification.validation.ts | src/modules/notifications/ | Joi schema for notification query |
| notification.service.ts | src/modules/notifications/ | Alert trigger, dedup, email queue, CRUD, SendGrid/SES providers |
| notification.controller.ts | src/modules/notifications/ | 4 route handlers |
| notification.routes.ts | src/modules/notifications/ | Router (student-only) |
| notification.jobs.ts | src/modules/notifications/ | Weekly reminder cron job |

## Frontend Files Generated

| File | Path | Purpose |
|---|---|---|
| notificationSlice.ts | src/frontend/features/notifications/store/ | Redux state + 4 async thunks |
| NotificationBell.tsx | src/frontend/features/notifications/components/ | Bell icon with badge + dropdown |
| NotificationList.tsx | src/frontend/features/notifications/components/ | Paginated notification list |
| AlertDashboard.tsx | src/frontend/features/notifications/components/ | Full-page alert dashboard |

## Test Files Generated

| File | Type | Coverage |
|---|---|---|
| notification.service.test.ts | Unit | checkAndAlert (threshold, dedup, creation), markAsRead (IDOR, success), getNotifications |
| notification.pbt.test.ts | PBT (fast-check) | Threshold invariant, retry invariant, unread count, dedup window |
| notification.integration.test.ts | Integration | GET /notifications (student/faculty), PUT /read-all |

## Email Provider Integration

| Provider | Config | Fallback |
|---|---|---|
| SendGrid | EMAIL_PROVIDER=sendgrid (default), SENDGRID_API_KEY | AWS SES |
| AWS SES | EMAIL_PROVIDER=ses, AWS credentials | SendGrid |
| Retry | 3 attempts: 5min → 15min → 60min backoff | Dead-letter after 3 failures |
