import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'student' | 'faculty' | 'admin';

export interface ProfileAuditEntry {
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  action: 'created' | 'updated' | 'deactivated' | 'reactivated' | 'photo_uploaded' | 'photo_deleted';
  fields: string[];
  previousValues: Record<string, unknown>;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  isActive: boolean;
  collegeId: mongoose.Types.ObjectId | null;

  // Student fields
  rollNumber?: string;
  department?: string;
  yearSemester?: string;
  academicYear?: string;
  profilePhotoUrl?: string | null;
  profilePhotoKey?: string | null;
  phone?: string | null;
  parentContact?: string | null;

  // Faculty fields
  employeeId?: string;
  designation?: string | null;

  // Audit
  auditLog: ProfileAuditEntry[];

  createdAt: Date;
  updatedAt: Date;
}

const auditEntrySchema = new Schema<ProfileAuditEntry>(
  {
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    action: {
      type: String,
      enum: ['created', 'updated', 'deactivated', 'reactivated', 'photo_uploaded', 'photo_deleted'],
      required: true,
    },
    fields: [{ type: String }],
    previousValues: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'faculty', 'admin'],
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    isActive: { type: Boolean, default: true },
    collegeId: { type: Schema.Types.ObjectId, default: null },

    // Student fields
    rollNumber: { type: String, trim: true, maxlength: 20 },
    department: { type: String, trim: true, maxlength: 100 },
    yearSemester: { type: String, trim: true, maxlength: 30 },
    academicYear: { type: String, trim: true, maxlength: 10 },
    profilePhotoUrl: { type: String, maxlength: 1000, default: null },
    profilePhotoKey: { type: String, maxlength: 500, default: null, select: false },
    phone: { type: String, trim: true, maxlength: 20, default: null },
    parentContact: { type: String, trim: true, maxlength: 200, default: null, select: false },

    // Faculty fields
    employeeId: { type: String, trim: true, maxlength: 20 },
    designation: { type: String, trim: true, maxlength: 100, default: null },

    // Audit log — never returned in API responses
    auditLog: { type: [auditEntrySchema], default: [], select: false },
  },
  {
    timestamps: true,
    versionKey: '__v', // used for optimistic concurrency
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ rollNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ department: 1, role: 1, isActive: 1 });
userSchema.index({ academicYear: 1, role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index(
  { name: 'text', email: 'text', rollNumber: 'text', employeeId: 'text' },
  { weights: { name: 10, rollNumber: 8, employeeId: 8, email: 5 }, name: 'user_text_search' }
);

export const UserModel = mongoose.model<IUser>('User', userSchema);
