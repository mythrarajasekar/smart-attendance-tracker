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
exports.AttendanceRecordModel = exports.AttendanceSessionModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const attendanceSessionSchema = new mongoose_1.Schema({
    subjectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subject', required: true },
    facultyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    sessionLabel: { type: String, required: true, trim: true, maxlength: 50 },
    sessionId: { type: String, required: true, unique: true },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    totalStudents: { type: Number, default: 0 },
    presentCount: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    collegeId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
}, { timestamps: true, versionKey: '__v' });
attendanceSessionSchema.index({ sessionId: 1 }, { unique: true });
attendanceSessionSchema.index({ subjectId: 1, date: -1 });
attendanceSessionSchema.index({ facultyId: 1, date: -1 });
exports.AttendanceSessionModel = mongoose_1.default.model('AttendanceSession', attendanceSessionSchema);
const attendanceRecordSchema = new mongoose_1.Schema({
    sessionId: { type: String, required: true },
    attendanceSessionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
    studentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    subjectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subject', required: true },
    facultyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent'], required: true },
    markedAt: { type: Date, default: Date.now },
    editedAt: { type: Date, default: null },
    editedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    editReason: { type: String, maxlength: 500, default: null },
    collegeId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
// Indexes
attendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
attendanceRecordSchema.index({ studentId: 1, subjectId: 1 });
attendanceRecordSchema.index({ subjectId: 1, date: -1 });
attendanceRecordSchema.index({ studentId: 1, date: -1 });
attendanceRecordSchema.index({ subjectId: 1, studentId: 1, date: -1 });
attendanceRecordSchema.index({ attendanceSessionId: 1 });
exports.AttendanceRecordModel = mongoose_1.default.model('AttendanceRecord', attendanceRecordSchema);
