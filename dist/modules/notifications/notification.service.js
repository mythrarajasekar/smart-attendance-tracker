"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = exports.checkAndAlert = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
const client_ses_1 = require("@aws-sdk/client-ses");
const notification_model_1 = require("./notification.model");
const user_model_1 = require("../users/user.model");
const subject_model_1 = require("../subjects/subject.model");
const redisClient_1 = __importDefault(require("../../shared/utils/redisClient"));
const logger_1 = require("../../shared/utils/logger");
const AppError_1 = require("../../shared/errors/AppError");
const MAX_EMAIL_ATTEMPTS = 3;
const DEDUP_TTL = 86400; // 24 hours
function escape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function buildEmailTemplate(payload) {
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
async function sendEmailViaSendGrid(payload) {
    mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
    await mail_1.default.send({
        to: payload.studentEmail,
        from: process.env.EMAIL_FROM || 'noreply@attendance.edu',
        subject: `Low Attendance Alert — ${payload.subjectCode}`,
        html: buildEmailTemplate(payload),
    });
}
async function sendEmailViaSES(payload) {
    const sesClient = new client_ses_1.SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    await sesClient.send(new client_ses_1.SendEmailCommand({
        Destination: { ToAddresses: [payload.studentEmail] },
        Message: {
            Subject: { Data: `Low Attendance Alert — ${payload.subjectCode}` },
            Body: { Html: { Data: buildEmailTemplate(payload) } },
        },
        Source: process.env.EMAIL_FROM || 'noreply@attendance.edu',
    }));
}
async function sendEmail(payload) {
    const provider = process.env.EMAIL_PROVIDER || 'sendgrid';
    if (provider === 'ses') {
        await sendEmailViaSES(payload);
    }
    else {
        await sendEmailViaSendGrid(payload);
    }
}
// ─── Simple async email queue with retry ─────────────────────────────────────
const emailQueue = [];
let isProcessing = false;
function enqueueEmail(job) {
    emailQueue.push(job);
    if (!isProcessing)
        processEmailQueue();
}
async function processEmailQueue() {
    if (emailQueue.length === 0) {
        isProcessing = false;
        return;
    }
    isProcessing = true;
    const job = emailQueue.shift();
    try {
        await sendEmail(job);
        await notification_model_1.NotificationModel.findByIdAndUpdate(job.notificationId, {
            $set: { emailStatus: 'sent', emailSentAt: new Date() },
            $inc: { emailAttempts: 1 },
        });
        logger_1.logger.info('notification.email.sent', { notificationId: job.notificationId, attempt: job.attempt });
    }
    catch (err) {
        const nextAttempt = job.attempt + 1;
        logger_1.logger.warn('notification.email.failed', { notificationId: job.notificationId, attempt: job.attempt, err: String(err) });
        if (nextAttempt <= MAX_EMAIL_ATTEMPTS) {
            const delayMs = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000][job.attempt - 1] || 60 * 60 * 1000;
            setTimeout(() => enqueueEmail({ ...job, attempt: nextAttempt }), delayMs);
        }
        else {
            await notification_model_1.NotificationModel.findByIdAndUpdate(job.notificationId, {
                $set: { emailStatus: 'failed', lastEmailError: String(err), emailAttempts: MAX_EMAIL_ATTEMPTS },
            });
            logger_1.logger.error('notification.email.dead_letter', { notificationId: job.notificationId });
        }
    }
    setImmediate(() => processEmailQueue());
}
// ─── Alert service ────────────────────────────────────────────────────────────
async function checkAndAlert(studentId, subjectId, percentage, threshold) {
    if (percentage >= threshold)
        return;
    // Atomic deduplication check using Redis
    let isFirst = true;
    try {
        const result = await redisClient_1.default.set(`alert:${studentId}:${subjectId}`, '1', 'EX', DEDUP_TTL, 'NX');
        isFirst = result === 'OK';
    }
    catch {
        // Fail open — allow alert if Redis unavailable
        logger_1.logger.warn('notification.dedup.redis_unavailable', {
            studentId,
            subjectId
        });
    }
    if (!isFirst) {
        logger_1.logger.debug('notification.alert.suppressed', {
            studentId,
            subjectId,
            percentage
        });
        return;
    }
    // Load student and subject details
    const [student, subject] = await Promise.all([
        user_model_1.UserModel.findById(studentId).select('name email'),
        subject_model_1.SubjectModel.findById(subjectId).select('name code'),
    ]);
    if (!student || !subject) {
        logger_1.logger.warn('notification.alert.missing_data', {
            studentId,
            subjectId
        });
        return;
    }
    const message = `Your attendance in ${subject.code} — ${subject.name} is ${percentage.toFixed(2)}% (below ${threshold}%)`;
    // Create in-app notification
    const notification = await notification_model_1.NotificationModel.create({
        userId: new mongoose_1.default.Types.ObjectId(studentId),
        subjectId: new mongoose_1.default.Types.ObjectId(subjectId),
        type: 'low_attendance',
        message,
        emailStatus: 'pending',
    });
    logger_1.logger.info('notification.alert.triggered', {
        studentId,
        subjectId,
        percentage,
        threshold,
        notificationId: notification._id.toString(),
    });
    // Enqueue email
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
exports.checkAndAlert = checkAndAlert;
// ─── Notification CRUD ────────────────────────────────────────────────────────
async function getNotifications(userId, filters) {
    const query = { userId: new mongoose_1.default.Types.ObjectId(userId) };
    if (filters.read !== undefined)
        query.read = filters.read;
    const skip = (filters.page - 1) * filters.limit;
    const [data, total, unreadCount] = await Promise.all([
        notification_model_1.NotificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit),
        notification_model_1.NotificationModel.countDocuments(query),
        notification_model_1.NotificationModel.countDocuments({ userId: new mongoose_1.default.Types.ObjectId(userId), read: false }),
    ]);
    return { data, total, unreadCount, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
}
exports.getNotifications = getNotifications;
async function markAsRead(notificationId, userId) {
    const notification = await notification_model_1.NotificationModel.findById(notificationId);
    if (!notification)
        throw new AppError_1.NotFoundError('Notification');
    if (notification.userId.toString() !== userId)
        throw new AppError_1.AuthorizationError('Not your notification');
    await notification_model_1.NotificationModel.findByIdAndUpdate(notificationId, {
        $set: { read: true, readAt: new Date() },
    });
}
exports.markAsRead = markAsRead;
async function markAllAsRead(userId) {
    await notification_model_1.NotificationModel.updateMany({ userId: new mongoose_1.default.Types.ObjectId(userId), read: false }, { $set: { read: true, readAt: new Date() } });
}
exports.markAllAsRead = markAllAsRead;
async function deleteNotification(notificationId, userId) {
    const notification = await notification_model_1.NotificationModel.findById(notificationId);
    if (!notification)
        throw new AppError_1.NotFoundError('Notification');
    if (notification.userId.toString() !== userId)
        throw new AppError_1.AuthorizationError('Not your notification');
    await notification_model_1.NotificationModel.deleteOne({ _id: notificationId });
}
exports.deleteNotification = deleteNotification;
