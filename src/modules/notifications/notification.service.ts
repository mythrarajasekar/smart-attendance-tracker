import mongoose from 'mongoose';
import sgMail from '@sendgrid/mail';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { NotificationModel, INotification } from './notification.model';
import { UserModel } from '../users/user.model';
import { SubjectModel } from '../subjects/subject.model';
import redisClient from '../../shared/utils/redisClient';
import { logger } from '../../shared/utils/logger';
import { NotFoundError, AuthorizationError } from '../../shared/errors/AppError';

const MAX_EMAIL_ATTEMPTS = 3;
const DEDUP_TTL = 86400; // 24 hours

// ─── Email provider abstraction ───────────────────────────────────────────────

interface EmailJobPayload {
  notificationId: string;
  studentEmail: string;
  studentName: string;
  subjectName: string;
  subjectCode: string;
  currentPercentage: number;
  threshold: number;
  attempt: number;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildEmailTemplate(payload: EmailJobPayload): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
      <h2 style="color: #d32f2f;">&#9888; Low Attendance Alert</h2>
      <p>Dear <strong>${escape(payload.studentName)}</strong>,</p>
      <p>Your attendance in <strong>${escape(payload.subjectCode)} &mdash; ${escape(payload.subjectName)}</strong>
         has fallen below the required threshold.</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Current Attendance</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #d32f2f;"><strong>${payload.currentPercentage.toFixed(2)}%</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Required Threshold</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>${payload.threshold}%</strong></td></tr>
      </table>
      <p style="margin-top: 16px;">Please attend classes regularly to avoid academic consequences.</p>
    </div>
  `;
}

async function sendEmailViaSendGrid(payload: EmailJobPayload): Promise<void> {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  await sgMail.send({
    to: payload.studentEmail,
    from: process.env.EMAIL_FROM || 'noreply@attendance.edu',
    subject: `Low Attendance Alert — ${payload.subjectCode}`,
    html: buildEmailTemplate(payload),
  });
}

async function sendEmailViaSES(payload: EmailJobPayload): Promise<void> {
  const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
  await sesClient.send(new SendEmailCommand({
    Destination: { ToAddresses: [payload.studentEmail] },
    Message: {
      Subject: { Data: `Low Attendance Alert — ${payload.subjectCode}` },
      Body: { Html: { Data: buildEmailTemplate(payload) } },
    },
    Source: process.env.EMAIL_FROM || 'noreply@attendance.edu',
  }));
}

async function sendEmail(payload: EmailJobPayload): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER || 'sendgrid';
  if (provider === 'ses') {
    await sendEmailViaSES(payload);
  } else {
    await sendEmailViaSendGrid(payload);
  }
}

// ─── Simple async email queue with retry ─────────────────────────────────────

const emailQueue: EmailJobPayload[] = [];
let isProcessing = false;

function enqueueEmail(job: EmailJobPayload): void {
  emailQueue.push(job);
  if (!isProcessing) processEmailQueue();
}

async function processEmailQueue(): Promise<void> {
  if (emailQueue.length === 0) { isProcessing = false; return; }
  isProcessing = true;
  const job = emailQueue.shift()!;

  try {
    await sendEmail(job);
    await NotificationModel.findByIdAndUpdate(job.notificationId, {
      $set: { emailStatus: 'sent', emailSentAt: new Date() },
      $inc: { emailAttempts: 1 },
    });
    logger.info('notification.email.sent', { notificationId: job.notificationId, attempt: job.attempt });
  } catch (err) {
    const nextAttempt = job.attempt + 1;
    logger.warn('notification.email.failed', { notificationId: job.notificationId, attempt: job.attempt, err: String(err) });

    if (nextAttempt <= MAX_EMAIL_ATTEMPTS) {
      const delayMs = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000][job.attempt - 1] || 60 * 60 * 1000;
      setTimeout(() => enqueueEmail({ ...job, attempt: nextAttempt }), delayMs);
    } else {
      await NotificationModel.findByIdAndUpdate(job.notificationId, {
        $set: { emailStatus: 'failed', lastEmailError: String(err), emailAttempts: MAX_EMAIL_ATTEMPTS },
      });
      logger.error('notification.email.dead_letter', { notificationId: job.notificationId });
    }
  }

  setImmediate(() => processEmailQueue());
}

// ─── Alert service ────────────────────────────────────────────────────────────

export async function checkAndAlert(
  studentId: string,
  subjectId: string,
  percentage: number,
  threshold: number
): Promise<void> {
  if (percentage >= threshold) return;

  // Atomic deduplication check using SET NX
  let isFirst = true;
  try {
    const result = await redisClient.set(
      `alert:${studentId}:${subjectId}`,
      '1',
      'NX',
      'EX',
      DEDUP_TTL
    );
    isFirst = result === 'OK';
  } catch {
    // Fail open — allow alert if Redis unavailable
    logger.warn('notification.dedup.redis_unavailable', { studentId, subjectId });
  }

  if (!isFirst) {
    logger.debug('notification.alert.suppressed', { studentId, subjectId, percentage });
    return;
  }

  // Load student and subject details
  const [student, subject] = await Promise.all([
    UserModel.findById(studentId).select('name email'),
    SubjectModel.findById(subjectId).select('name code'),
  ]);

  if (!student || !subject) {
    logger.warn('notification.alert.missing_data', { studentId, subjectId });
    return;
  }

  const message = `Your attendance in ${subject.code} — ${subject.name} is ${percentage.toFixed(2)}% (below ${threshold}%)`;

  // Create in-app notification
  const notification = await NotificationModel.create({
    userId: new mongoose.Types.ObjectId(studentId),
    subjectId: new mongoose.Types.ObjectId(subjectId),
    type: 'low_attendance',
    message,
    emailStatus: 'pending',
  });

  logger.info('notification.alert.triggered', { studentId, subjectId, percentage, threshold, notificationId: notification._id.toString() });

  // Enqueue email (non-blocking)
  enqueueEmail({
    notificationId: notification._id.toString(),
    studentEmail: student.email,
    studentName: student.name,
    subjectName: subject.name,
    subjectCode: subject.code,
    currentPercentage: percentage,
    threshold,
    attempt: 1,
  });
}

// ─── Notification CRUD ────────────────────────────────────────────────────────

export async function getNotifications(
  userId: string,
  filters: { read?: boolean; page: number; limit: number }
): Promise<{ data: INotification[]; total: number; unreadCount: number; page: number; limit: number; totalPages: number }> {
  const query: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) };
  if (filters.read !== undefined) query.read = filters.read;

  const skip = (filters.page - 1) * filters.limit;

  const [data, total, unreadCount] = await Promise.all([
    NotificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit),
    NotificationModel.countDocuments(query),
    NotificationModel.countDocuments({ userId: new mongoose.Types.ObjectId(userId), read: false }),
  ]);

  return { data, total, unreadCount, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  const notification = await NotificationModel.findById(notificationId);
  if (!notification) throw new NotFoundError('Notification');
  if (notification.userId.toString() !== userId) throw new AuthorizationError('Not your notification');

  await NotificationModel.findByIdAndUpdate(notificationId, {
    $set: { read: true, readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  await NotificationModel.updateMany(
    { userId: new mongoose.Types.ObjectId(userId), read: false },
    { $set: { read: true, readAt: new Date() } }
  );
}

export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  const notification = await NotificationModel.findById(notificationId);
  if (!notification) throw new NotFoundError('Notification');
  if (notification.userId.toString() !== userId) throw new AuthorizationError('Not your notification');

  await NotificationModel.deleteOne({ _id: notificationId });
}
