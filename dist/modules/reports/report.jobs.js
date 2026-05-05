"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReportCacheCleanupJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../../shared/utils/logger");
const redisClient_1 = __importDefault(require("../../shared/utils/redisClient"));
/**
 * Weekly report cache cleanup job.
 * Removes stale report cache keys older than 7 days.
 * Runs every Sunday at 3:00 AM.
 */
function startReportCacheCleanupJob() {
    node_cron_1.default.schedule('0 3 * * 0', async () => {
        logger_1.logger.info('report.cache_cleanup.start');
        try {
            const keys = await redisClient_1.default.keys('report:*');
            if (keys.length > 0) {
                await redisClient_1.default.del(...keys);
                logger_1.logger.info('report.cache_cleanup.complete', { keysDeleted: keys.length });
            }
        }
        catch (err) {
            logger_1.logger.error('report.cache_cleanup.failed', { err });
        }
    });
    logger_1.logger.info('report.cache_cleanup.job_registered', { schedule: '0 3 * * 0' });
}
exports.startReportCacheCleanupJob = startReportCacheCleanupJob;
