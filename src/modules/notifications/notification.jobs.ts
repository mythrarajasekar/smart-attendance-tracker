import cron from 'node-cron';
import mongoose from 'mongoose';
import { AttendanceRecordModel } from '../attendance/attendance.model';
import { checkAndAlert } from './notification.service';
import { logger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redisClient';

const DEFAULT_THRESHOLD = 75;

/**
 * Weekly reminder job: re-triggers alerts for students with persistent low attendance.
 * Runs every Monday at 8:00 AM.
 * Schedule: '0 8 * * 1'
 */
export function startWeeklyReminderJob(): void {
  cron.schedule('0 8 * * 1', async () => {
    logger.info('notification.weekly_reminder.start');
    let triggered = 0;
    let skipped = 0;

    try {
      // Read threshold from settings (default 75 if unavailable)
      let threshold = DEFAULT_THRESHOLD;
      try {
        const cached = await redisClient.get('settings:global');
        if (cached) {
          const settings = JSON.parse(cached);
          threshold = settings.attendanceThreshold ?? DEFAULT_THRESHOLD;
        }
      } catch { /* use default */ }

      // Find all student-subject pairs with attendance below threshold
      const belowThreshold = await AttendanceRecordModel.aggregate([
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

      logger.info('notification.weekly_reminder.pairs_found', { count: belowThreshold.length, threshold });

      for (const pair of belowThreshold) {
        try {
          await checkAndAlert(
            (pair.studentId as mongoose.Types.ObjectId).toString(),
            (pair.subjectId as mongoose.Types.ObjectId).toString(),
            pair.percentage as number,
            threshold
          );
          triggered++;
        } catch (err) {
          skipped++;
          logger.error('notification.weekly_reminder.pair_failed', { pair, err });
        }
      }

      logger.info('notification.weekly_reminder.complete', { triggered, skipped });
    } catch (err) {
      logger.error('notification.weekly_reminder.fatal', { err });
    }
  });

  logger.info('notification.weekly_reminder.job_registered', { schedule: '0 8 * * 1' });
}
