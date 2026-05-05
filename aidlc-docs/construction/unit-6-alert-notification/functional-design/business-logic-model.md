# Business Logic Model — Unit 6: Alert & Notification System

## 1. Alert Trigger Flow (called by AttendanceService post-mark)

```
INPUT: studentId, subjectId, percentage

Step 1: Read global threshold from SettingsService (Redis-cached)
        IF percentage >= threshold → return (no alert needed)

Step 2: Check Redis deduplication key → GET alert:{studentId}:{subjectId}
        IF exists → return (duplicate suppressed within 24h)

Step 3: Load student profile → get email, name
        Load subject → get name, code

Step 4: Build notification message:
        "Your attendance in {subjectCode} - {subjectName} is {percentage}% (below {threshold}%)"

Step 5: Create in-app notification in MongoDB:
        { userId: studentId, subjectId, type: 'low_attendance', message, read: false,
          emailStatus: 'pending', emailAttempts: 0 }

Step 6: Set Redis deduplication key:
        SET alert:{studentId}:{subjectId} '1' EX 86400

Step 7: Enqueue email job (async, non-blocking):
        emailQueue.add({ notificationId, studentEmail, studentName, subjectName, subjectCode, percentage, threshold, attempt: 1 })

Step 8: Return (do not await email delivery)
```

## 2. Email Delivery with Retry

```
INPUT: EmailJobPayload

Step 1: Send email via SendGrid/SES:
        To: studentEmail
        Subject: "Low Attendance Alert — {subjectCode}"
        Body: HTML template with percentage, threshold, subject details

Step 2: IF success:
          Update notification: { emailStatus: 'sent', emailSentAt: now }
          Log: notification.email.sent

Step 3: IF failure:
          Increment emailAttempts
          IF emailAttempts < 3:
            Re-enqueue with exponential backoff:
              attempt 1 → retry after 5 minutes
              attempt 2 → retry after 15 minutes
              attempt 3 → retry after 60 minutes
          IF emailAttempts >= 3:
            Update notification: { emailStatus: 'failed', lastEmailError: error.message }
            Log: notification.email.dead_letter
            (in-app notification still visible — email failure is non-blocking)
```

## 3. Scheduled Reminder Job (Weekly)

```
Schedule: Every Monday at 8:00 AM (cron: '0 8 * * 1')

Step 1: Find all students with attendance < threshold across any subject
        (aggregate from AttendanceRecordModel)

Step 2: For each student+subject pair below threshold:
        Check Redis deduplication key
        IF not exists → trigger alert flow (Step 1 above)

Step 3: Log completion with count
```

## 4. Notification CRUD

```
GET /notifications (student — own only):
  Query: { userId: req.user.userId }
  Paginated, sorted by createdAt desc
  Returns unread count in response meta

PUT /notifications/:id/read:
  Validate ownership (userId === req.user.userId)
  $set: { read: true, readAt: now }

PUT /notifications/read-all:
  updateMany({ userId: req.user.userId, read: false }, { $set: { read: true, readAt: now } })

DELETE /notifications/:id:
  Validate ownership
  deleteOne({ _id: id, userId: req.user.userId })
```
