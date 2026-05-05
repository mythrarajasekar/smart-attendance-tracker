"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWeeklyReminderJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const attendance_model_1 = require("../attendance/attendance.model");
const notification_service_1 = require("./notification.service");
const logger_1 = require("../../shared/utils/logger");
const redisClient_1 = __importDefault(require("../../shared/utils/redisClient"));
const DEFAULT_THRESHOLD = 75;
/**
 * Weekly reminder job: re-triggers alerts for students with persistent low attendance.
 * Runs every Monday at 8:00 AM.
 * Schedule: '0 8 * * 1'
 */
function startWeeklyReminderJob() {
    node_cron_1.default.schedule('0 8 * * 1', async () => {
        logger_1.logger.info('notification.weekly_reminder.start');
        let triggered = 0;
        let skipped = 0;
        try {
            // Read threshold from settings (default 75 if unavailable)
            let threshold = DEFAULT_THRESHOLD;
            try {
                const cached = await redisClient_1.default.get('settings:global');
                if (cached) {
                    const settings = JSON.parse(cached);
                    threshold = settings.attendanceThreshold ?? DEFAULT_THRESHOLD;
                }
            }
            catch { /* use default */ }
            // Find all student-subject pairs with attendance below threshold
            const belowThreshold = await attendance_model_1.AttendanceRecordModel.aggregate([
                {
                    $group: {
                        _id: { studentId: '$studentId', subjectId: '$subjectId' },
                        total: { $sum: 1 },
                        attended: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
                    },
                },
                {
                    $project: {
                        studentId: '$_id.studentId',
                        subjectId: '$_id.subjectId',
                        percentage: {
                            $cond: [
                                { $eq: ['$total', 0] }, 0,
                                { $round: [{ $multiply: [{ $divide: ['$attended', '$total'] }, 100] }, 2] },
                            ],
                        },
                    },
                },
                { $match: { percentage: { $lt: threshold } } },
            ]);
            logger_1.logger.info('notification.weekly_reminder.pairs_found', { count: belowThreshold.length, threshold });
            for (const pair of belowThreshold) {
                try {
                    await (0, notification_service_1.checkAndAlert)(pair.studentId.toString(), pair.subjectId.toString(), pair.percentage, threshold);
                    triggered++;
                }
                catch (err) {
                    skipped++;
                    logger_1.logger.error('notification.weekly_reminder.pair_failed', { pair, err });
                }
            }
            logger_1.logger.info('notification.weekly_reminder.complete', { triggered, skipped });
        }
        catch (err) {
            logger_1.logger.error('notification.weekly_reminder.fatal', { err });
        }
    });
    logger_1.logger.info('notification.weekly_reminder.job_registered', { schedule: '0 8 * * 1' });
}
exports.startWeeklyReminderJob = startWeeklyReminderJob;
