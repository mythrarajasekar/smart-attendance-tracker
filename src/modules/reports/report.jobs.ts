import cron from 'node-cron';
import { logger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redisClient';

/**
 * Weekly report cache cleanup job.
 * Removes stale report cache keys older than 7 days.
 * Runs every Sunday at 3:00 AM.
 */
export function startReportCacheCleanupJob(): void {
  cron.schedule('0 3 * * 0', async () => {
    logger.info('report.cache_cleanup.start');
    try {
      const keys = await redisClient.keys('report:*');
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info('report.cache_cleanup.complete', { keysDeleted: keys.length });
      }
    } catch (err) {
      logger.error('report.cache_cleanup.failed', { err });
    }
  });

  logger.info('report.cache_cleanup.job_registered', { schedule: '0 3 * * 0' });
}
