"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAttendanceRecalculationJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const attendance_model_1 = require("./attendance.model");
const attendance_service_1 = require("./attendance.service");
const logger_1 = require("../../shared/utils/logger");
function chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size)
        chunks.push(arr.slice(i, i + size));
    return chunks;
}
/**
 * Nightly background job: recalculates all attendance percentages.
 * Runs at 2:00 AM daily to fix any Redis cache drift.
 * Schedule: '0 2 * * *'
 */
function startAttendanceRecalculationJob() {
    node_cron_1.default.schedule('0 2 * * *', async () => {
        logger_1.logger.info('attendance.recalculation.start');
        let processed = 0;
        let errors = 0;
        try {
            // Get all distinct student-subject pairs
            const pairs = await attendance_model_1.AttendanceRecordModel.aggregate([
                { $group: { _id: { studentId: '$studentId', subjectId: '$subjectId' } } },
                { $project: { studentId: '$_id.studentId', subjectId: '$_id.subjectId', _id: 0 } },
            ]);
            logger_1.logger.info('attendance.recalculation.pairs_found', { count: pairs.length });
            // Process in batches of 50 to avoid overwhelming Redis
            for (const batch of chunk(pairs, 50)) {
                await Promise.all(batch.map(async ({ studentId, subjectId }) => {
                    try {
                        await (0, attendance_service_1.calculateAndCachePercentage)(studentId.toString(), subjectId.toString());
                        processed++;
                    }
                    catch (err) {
                        errors++;
                        logger_1.logger.error('attendance.recalculation.pair_failed', {
                            studentId: studentId.toString(),
                            subjectId: subjectId.toString(),
                            err,
                        });
                    }
                }));
            }
            logger_1.logger.info('attendance.recalculation.complete', { processed, errors });
        }
        catch (err) {
            logger_1.logger.error('attendance.recalculation.fatal', { err });
        }
    });
    logger_1.logger.info('attendance.recalculation.job_registered', { schedule: '0 2 * * *' });
}
exports.startAttendanceRecalculationJob = startAttendanceRecalculationJob;
