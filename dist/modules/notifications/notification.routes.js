"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const notification_controller_1 = require("./notification.controller");
const router = (0, express_1.Router)();
// All notification routes are student-only (own notifications)
router.get('/', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['student']), notification_controller_1.getNotificationsHandler);
router.put('/read-all', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['student']), notification_controller_1.markAllAsReadHandler);
router.put('/:id/read', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['student']), notification_controller_1.markAsReadHandler);
router.delete('/:id', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['student']), notification_controller_1.deleteNotificationHandler);
exports.default = router;
