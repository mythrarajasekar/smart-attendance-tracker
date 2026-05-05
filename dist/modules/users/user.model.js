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
exports.UserModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const auditEntrySchema = new mongoose_1.Schema({
    changedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    action: {
        type: String,
        enum: ['created', 'updated', 'deactivated', 'reactivated', 'photo_uploaded', 'photo_deleted'],
        required: true,
    },
    fields: [{ type: String }],
    previousValues: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { _id: false });
const userSchema = new mongoose_1.Schema({
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
    collegeId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
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
}, {
    timestamps: true,
    versionKey: '__v', // used for optimistic concurrency
});
// ─── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ rollNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ department: 1, role: 1, isActive: 1 });
userSchema.index({ academicYear: 1, role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ name: 'text', email: 'text', rollNumber: 'text', employeeId: 'text' }, { weights: { name: 10, rollNumber: 8, employeeId: 8, email: 5 }, name: 'user_text_search' });
exports.UserModel = mongoose_1.default.model('User', userSchema);
