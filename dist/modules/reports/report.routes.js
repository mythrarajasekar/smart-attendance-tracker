"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const report_controller_1 = require("./report.controller");
const router = (0, express_1.Router)();
// Student monthly report — student (own) or admin
router.get('/student/:studentId/monthly', (0, auth_middleware_1.authenticate)(), report_controller_1.studentReportHandler);
// Subject monthly report — faculty (assigned) or admin
router.get('/subject/:subjectId/monthly', (0, auth_middleware_1.authenticate)(), (0, auth_middleware_1.authorize)(['faculty', 'admin']), report_controller_1.subjectReportHandler);
exports.default = router;
