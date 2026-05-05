# NFR Design Patterns — Unit 6: Alert & Notification System

## 1. Queue-Based Async Email Processing

```typescript
// In-memory queue using Bull (Redis-backed in production)
// For v1: simple async queue with retry logic

class EmailQueue {
  private queue: EmailJobPayload[] = [];
  private processing = false;

  add(job: EmailJobPayload): void {
    this.queue.push(job);
    if (!this.processing) this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) { this.processing = false; return; }
    this.processing = true;
    const job = this.queue.shift()!;
    await this.processJob(job);
    setImmediate(() => this.processNext());
  }

  private async processJob(job: EmailJobPayload): Promise<void> {
    try {
      await emailService.send(job);
      await NotificationModel.findByIdAndUpdate(job.notificationId, {
        $set: { emailStatus: 'sent', emailSentAt: new Date() },
      });
    } catch (err) {
      const nextAttempt = job.attempt + 1;
      if (nextAttempt <= 3) {
        const delayMs = [5, 15, 60][job.attempt - 1] * 60 * 1000;
        setTimeout(() => this.add({ ...job, attempt: nextAttempt }), delayMs);
      } else {
        await NotificationModel.findByIdAndUpdate(job.notificationId, {
          $set: { emailStatus: 'failed', lastEmailError: String(err), emailAttempts: 3 },
        });
        logger.error('notification.email.dead_letter', { notificationId: job.notificationId, err });
      }
    }
  }
}
```

## 2. Email Provider Abstraction (SendGrid / AWS SES)

```typescript
interface EmailProvider {
  send(payload: EmailJobPayload): Promise<void>;
}

class SendGridProvider implements EmailProvider {
  async send(payload: EmailJobPayload): Promise<void> {
    await sgMail.send({
      to: payload.studentEmail,
      from: process.env.EMAIL_FROM!,
      subject: `Low Attendance Alert — ${payload.subjectCode}`,
      html: buildEmailTemplate(payload),
    });
  }
}

class SESProvider implements EmailProvider {
  async send(payload: EmailJobPayload): Promise<void> {
    await sesClient.send(new SendEmailCommand({
      Destination: { ToAddresses: [payload.studentEmail] },
      Message: {
        Subject: { Data: `Low Attendance Alert — ${payload.subjectCode}` },
        Body: { Html: { Data: buildEmailTemplate(payload) } },
      },
      Source: process.env.EMAIL_FROM!,
    }));
  }
}

// Factory: select provider based on EMAIL_PROVIDER env var
function getEmailProvider(): EmailProvider {
  return process.env.EMAIL_PROVIDER === 'ses' ? new SESProvider() : new SendGridProvider();
}
```

## 3. Redis Deduplication Pattern

```typescript
// Key: alert:{userId}:{subjectId}
// TTL: 86400 seconds (24 hours)
// Atomic check-and-set using SET NX (set if not exists)

async function checkAndSetDedup(userId: string, subjectId: string): Promise<boolean> {
  try {
    // SET key value NX EX ttl — returns 'OK' if set, null if already exists
    const result = await redisClient.set(
      `alert:${userId}:${subjectId}`,
      '1',
      'NX',  // only set if not exists
      'EX',
      86400
    );
    return result === 'OK'; // true = first alert, false = duplicate
  } catch {
    return true; // fail open — allow alert if Redis unavailable
  }
}
```

## 4. Email Template (HTML — sanitized)

```typescript
function buildEmailTemplate(payload: EmailJobPayload): string {
  // All values are escaped — no user-controlled HTML
  const escape = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #d32f2f;">⚠️ Low Attendance Alert</h2>
      <p>Dear <strong>${escape(payload.studentName)}</strong>,</p>
      <p>Your attendance in <strong>${escape(payload.subjectCode)} — ${escape(payload.subjectName)}</strong>
         has fallen below the required threshold.</p>
      <table>
        <tr><td>Current Attendance:</td><td><strong>${payload.currentPercentage.toFixed(2)}%</strong></td></tr>
        <tr><td>Required Threshold:</td><td><strong>${payload.threshold}%</strong></td></tr>
      </table>
      <p>Please attend classes regularly to avoid academic consequences.</p>
    </div>
  `;
}
```
