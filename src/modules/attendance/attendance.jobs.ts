import cron from 'node-cron';
import mongoose from 'mongoose';
import { AttendanceRecordModel } from './attendance.model';
import { calculateAndCachePercentage } from './attendance.service';
import { logger } from '../../shared/utils/logger';

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

/**
 * Nightly background job: recalculates all attendance percentages.
 * Runs at 2:00 AM daily to fix any Redis cache drift.
 * Schedule: '0 2 * * *'
 */
export function startAttendanceRecalculationJob(): void {
  cron.schedule('0 2 * * *', async () => {
    logger.info('attendance.recalculation.start');
    let processed = 0;
    let errors = 0;

    try {
      // Get all distinct student-subject pairs
      const pairs = await AttendanceRecordModel.aggregate([
        { $group: { _id: { studentId: '$studentId', subjectId: '$subjectId' } } },
        { $project: { studentId: '$_id.studentId', subjectId: '$_id.subjectId', _id: 0 } },
      ]);

      logger.info('attendance.recalculation.pairs_found', { count: pairs.length });

      // Process in batches of 50 to avoid overwhelming Redis
      for (const batch of chunk(pairs, 50)) {
        await Promise.all(
          batch.map(async ({ studentId, subjectId }: { studentId: mongoose.Types.ObjectId; subjectId: mongoose.Types.ObjectId }) => {
            try {
              await calculateAndCachePercentage(studentId.toString(), subjectId.toString());
              processed++;
            } catch (err) {
              errors++;
              logger.error('attendance.recalculation.pair_failed', {
                studentId: studentId.toString(),
                subjectId: subjectId.toString(),
                err,
              });
            }
          })
        );
      }

      logger.info('attendance.recalculation.complete', { processed, errors });
    } catch (err) {
      logger.error('attendance.recalculation.fatal', { err });
    }
  });

  logger.info('attendance.recalculation.job_registered', { schedule: '0 2 * * *' });
}
