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
exports.NotificationModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const notificationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    subjectId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subject', required: true },
    type: { type: String, enum: ['low_attendance'], required: true },
    message: { type: String, required: true, maxlength: 500 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    emailStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    emailSentAt: { type: Date, default: null },
    emailAttempts: { type: Number, default: 0, max: 3 },
    lastEmailError: { type: String, default: null, maxlength: 500 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ emailStatus: 1, emailAttempts: 1 }); // for retry queries
exports.NotificationModel = mongoose_1.default.model('Notification', notificationSchema);
