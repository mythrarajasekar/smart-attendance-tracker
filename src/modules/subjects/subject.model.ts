import mongoose, { Document, Schema } from 'mongoose';

export interface SubjectAuditEntry {
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  action: 'created' | 'updated' | 'deactivated' | 'reactivated'
        | 'faculty_assigned' | 'faculty_removed'
        | 'student_enrolled' | 'student_unenrolled' | 'bulk_enrolled';
  details: Record<string, unknown>;
}

export interface ISubject extends Document {
  name: string;
  code: string;
  department: string;
  semester: string;
  academicYear: string;
  credits: number;
  capacity: number | null;
  isActive: boolean;
  collegeId: mongoose.Types.ObjectId | null;
  facultyIds: mongoose.Types.ObjectId[];
  studentIds: mongoose.Types.ObjectId[];
  auditLog: SubjectAuditEntry[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const auditEntrySchema = new Schema<SubjectAuditEntry>(
  {
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    action: {
      type: String,
      enum: ['created', 'updated', 'deactivated', 'reactivated',
             'faculty_assigned', 'faculty_removed',
             'student_enrolled', 'student_unenrolled', 'bulk_enrolled'],
      required: true,
    },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const subjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    semester: { type: String, required: true, trim: true, maxlength: 20 },
    academicYear: { type: String, required: true, trim: true, maxlength: 10 },
    credits: { type: Number, required: true, min: 1, max: 10 },
    capacity: { type: Number, min: 1, default: null },
    isActive: { type: Boolean, default: true },
    collegeId: { type: Schema.Types.ObjectId, default: null },
    facultyIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    studentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    auditLog: { type: [auditEntrySchema], default: [], select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
subjectSchema.index({ code: 1, academicYear: 1 }, { unique: true });
subjectSchema.index({ facultyIds: 1, isActive: 1 });
subjectSchema.index({ studentIds: 1, isActive: 1 });
subjectSchema.index({ department: 1, semester: 1, isActive: 1 });
subjectSchema.index({ academicYear: 1, isActive: 1 });
subjectSchema.index({ createdAt: -1 });
subjectSchema.index(
  { name: 'text', code: 'text' },
  { weights: { code: 10, name: 5 }, name: 'subject_text_search' }
);

export const SubjectModel = mongoose.model<ISubject>('Subject', subjectSchema);
