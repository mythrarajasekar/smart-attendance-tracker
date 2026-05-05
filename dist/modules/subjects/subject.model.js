"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const auditEntrySchema = new mongoose_1.Schema({
    changedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    action: {
        type: String,
        enum: ['created', 'updated', 'deactivated', 'reactivated',
            'faculty_assigned', 'faculty_removed',
            'student_enrolled', 'student_unenrolled', 'bulk_enrolled'],
        required: true,
    },
    details: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { _id: false });
const subjectSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    semester: { type: String, required: true, trim: true, maxlength: 20 },
    academicYear: { type: String, required: true, trim: true, maxlength: 10 },
    credits: { type: Number, required: true, min: 1, max: 10 },
    capacity: { type: Number, min: 1, default: null },
    isActive: { type: Boolean, default: true },
    collegeId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    facultyIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    studentIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    auditLog: { type: [auditEntrySchema], default: [], select: false },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, versionKey: false });
// ─── Indexes ─────────────────────────────────────────────────────────────────
subjectSchema.index({ code: 1, academicYear: 1 }, { unique: true });
subjectSchema.index({ facultyIds: 1, isActive: 1 });
subjectSchema.index({ studentIds: 1, isActive: 1 });
subjectSchema.index({ department: 1, semester: 1, isActive: 1 });
subjectSchema.index({ academicYear: 1, isActive: 1 });
subjectSchema.index({ createdAt: -1 });
subjectSchema.index({ name: 'text', code: 'text' }, { weights: { code: 10, name: 5 }, name: 'subject_text_search' });
exports.SubjectModel = mongoose_1.default.model('Subject', subjectSchema);
