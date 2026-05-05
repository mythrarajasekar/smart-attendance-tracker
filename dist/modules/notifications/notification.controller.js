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
exports.deleteNotificationHandler = exports.markAllAsReadHandler = exports.markAsReadHandler = exports.getNotificationsHandler = void 0;
const notificationService = __importStar(require("./notification.service"));
const notification_validation_1 = require("./notification.validation");
const AppError_1 = require("../../shared/errors/AppError");
async function getNotificationsHandler(req, res, next) {
    try {
        const { value, error } = notification_validation_1.notificationQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error)
            return next(new AppError_1.ValidationError('Validation failed', error.details));
        const result = await notificationService.getNotifications(req.user.userId, value);
        res.status(200).json({
            success: true,
            data: result.data,
            meta: { total: result.total, unreadCount: result.unreadCount, page: result.page, limit: result.limit, totalPages: result.totalPages },
        });
    }
    catch (err) {
        next(err);
    }
}
exports.getNotificationsHandler = getNotificationsHandler;
async function markAsReadHandler(req, res, next) {
    try {
        await notificationService.markAsRead(req.params.id, req.user.userId);
        res.status(200).json({ success: true, data: { message: 'Notification marked as read' } });
    }
    catch (err) {
        next(err);
    }
}
exports.markAsReadHandler = markAsReadHandler;
async function markAllAsReadHandler(req, res, next) {
    try {
        await notificationService.markAllAsRead(req.user.userId);
        res.status(200).json({ success: true, data: { message: 'All notifications marked as read' } });
    }
    catch (err) {
        next(err);
    }
}
exports.markAllAsReadHandler = markAllAsReadHandler;
async function deleteNotificationHandler(req, res, next) {
    try {
        await notificationService.deleteNotification(req.params.id, req.user.userId);
        res.status(200).json({ success: true, data: { message: 'Notification deleted' } });
    }
    catch (err) {
        next(err);
    }
}
exports.deleteNotificationHandler = deleteNotificationHandler;
