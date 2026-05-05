import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  type: 'low_attendance';
  message: string;
  read: boolean;
  readAt: Date | null;
  emailStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  emailSentAt: Date | null;
  emailAttempts: number;
  lastEmailError: string | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    type: { type: String, enum: ['low_attendance'], required: true },
    message: { type: String, required: true, maxlength: 500 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    emailStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    emailSentAt: { type: Date, default: null },
    emailAttempts: { type: Number, default: 0, max: 3 },
    lastEmailError: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ emailStatus: 1, emailAttempts: 1 }); // for retry queries

export const NotificationModel = mongoose.model<INotification>('Notification', notificationSchema);
