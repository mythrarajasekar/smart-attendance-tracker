import mongoose, { Document, Schema } from 'mongoose';

// ─── Attendance Session ───────────────────────────────────────────────────────

export interface IAttendanceSession extends Document {
  subjectId: mongoose.Types.ObjectId;
  facultyId: mongoose.Types.ObjectId;
  date: Date;
  sessionLabel: string;
  sessionId: string;            // unique: `${subjectId}_${dateStr}_${sessionLabel}`
  isLocked: boolean;
  lockedAt: Date | null;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  collegeId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    sessionLabel: { type: String, required: true, trim: true, maxlength: 50 },
    sessionId: { type: String, required: true, unique: true },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    totalStudents: { type: Number, default: 0 },
    presentCount: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    collegeId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, versionKey: '__v' }
);

attendanceSessionSchema.index({ sessionId: 1 }, { unique: true });
attendanceSessionSchema.index({ subjectId: 1, date: -1 });
attendanceSessionSchema.index({ facultyId: 1, date: -1 });

export const AttendanceSessionModel = mongoose.model<IAttendanceSession>('AttendanceSession', attendanceSessionSchema);

// ─── Attendance Record ────────────────────────────────────────────────────────

export interface IAttendanceRecord extends Document {
  sessionId: string;
  attendanceSessionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  facultyId: mongoose.Types.ObjectId;
  date: Date;
  status: 'present' | 'absent';
  markedAt: Date;
  editedAt: Date | null;
  editedBy: mongoose.Types.ObjectId | null;
  editReason: string | null;
  collegeId: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    sessionId: { type: String, required: true },
    attendanceSessionId: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent'], required: true },
    markedAt: { type: Date, default: Date.now },
    editedAt: { type: Date, default: null },
    editedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    editReason: { type: String, maxlength: 500, default: null },
    collegeId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Indexes
attendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
attendanceRecordSchema.index({ studentId: 1, subjectId: 1 });
attendanceRecordSchema.index({ subjectId: 1, date: -1 });
attendanceRecordSchema.index({ studentId: 1, date: -1 });
attendanceRecordSchema.index({ subjectId: 1, studentId: 1, date: -1 });
attendanceRecordSchema.index({ attendanceSessionId: 1 });

export const AttendanceRecordModel = mongoose.model<IAttendanceRecord>('AttendanceRecord', attendanceRecordSchema);
