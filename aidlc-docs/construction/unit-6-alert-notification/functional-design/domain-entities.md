# Domain Entities — Unit 6: Alert & Notification System

## Notification Entity (MongoDB)

```typescript
interface INotification {
  _id: ObjectId;
  userId: ObjectId;             // recipient (student)
  subjectId: ObjectId;
  type: 'low_attendance';
  message: string;              // e.g. "Your attendance in CS301 is 68.5% (below 75%)"
  read: boolean;
  readAt: Date | null;
  emailStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  emailSentAt: Date | null;
  emailAttempts: number;        // retry counter (max 3)
  lastEmailError: string | null;
  createdAt: Date;
}
```

## Alert Job Entry (Redis — ephemeral)

```typescript
// Redis key: alert:{userId}:{subjectId}
// Value: '1'
// TTL: 86400 seconds (24 hours)
// Purpose: deduplication — prevents duplicate alerts within 24h window
```

## Email Job Payload (in-memory queue)

```typescript
interface EmailJobPayload {
  notificationId: string;
  studentEmail: string;
  studentName: string;
  subjectName: string;
  subjectCode: string;
  currentPercentage: number;
  threshold: number;
  attempt: number;              // 1, 2, or 3
}
```

## Notification Query

```typescript
interface NotificationQuery {
  read?: boolean;
  page: number;
  limit: number;
}
```
