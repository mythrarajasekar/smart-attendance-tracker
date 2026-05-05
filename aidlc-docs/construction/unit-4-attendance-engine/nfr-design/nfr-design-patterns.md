# NFR Design Patterns — Unit 4: Attendance Engine

## 1. Idempotent Bulk Write Pattern

```typescript
// Upsert-based marking: safe to call multiple times
const bulkOps = records.map(({ studentId, status }) => ({
  updateOne: {
    filter: { sessionId, studentId },
    update: {
      $set: { status, markedAt: new Date(), facultyId, subjectId, date },
      $setOnInsert: { createdAt: new Date() },
    },
    upsert: true,
  },
}));
await AttendanceRecordModel.bulkWrite(bulkOps, { ordered: false });
// ordered: false → continue on individual failures, collect errors
```

## 2. Percentage Aggregation Pipeline

```typescript
const pipeline = [
  { $match: { studentId: new ObjectId(studentId), subjectId: new ObjectId(subjectId) } },
  {
    $group: {
      _id: null,
      total: { $sum: 1 },
      attended: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
    },
  },
  {
    $project: {
      _id: 0,
      total: 1,
      attended: 1,
      percentage: {
        $cond: [
          { $eq: ['$total', 0] },
          0,
          { $round: [{ $multiply: [{ $divide: ['$attended', '$total'] }, 100] }, 2] },
        ],
      },
    },
  },
];
```

## 3. Redis Percentage Cache Pattern

```typescript
// Cache key: attendance:pct:{studentId}:{subjectId}
// TTL: 300 seconds (5 minutes)
// Invalidated: after every mark/edit for that student+subject

async function calculateAndCachePercentage(
  studentId: string,
  subjectId: string
): Promise<AttendancePercentage> {
  const [result] = await AttendanceRecordModel.aggregate(pipeline);
  const pct = result ?? { total: 0, attended: 0, percentage: 0 };

  await redisClient.set(
    `attendance:pct:${studentId}:${subjectId}`,
    JSON.stringify(pct),
    'EX', 300
  );
  return pct;
}
```

## 4. Optimistic Concurrency for Session Updates

```typescript
// Sessions use Mongoose __v for optimistic concurrency
// Prevents two faculty members from simultaneously locking the same session
await AttendanceSessionModel.findOneAndUpdate(
  { sessionId, __v: currentVersion, isLocked: false },
  { $set: { isLocked: true, lockedAt: new Date() }, $inc: { __v: 1 } },
  { new: true }
);
// If null returned → session was modified concurrently → throw ConflictError
```

## 5. Background Recalculation Job

```typescript
// attendance.jobs.ts — runs nightly via node-cron
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => {
  logger.info('attendance.recalculation.start');
  const pairs = await AttendanceRecordModel.distinct('studentId subjectId');
  // Process in batches of 100 to avoid memory pressure
  for (const batch of chunk(pairs, 100)) {
    await Promise.all(batch.map(({ studentId, subjectId }) =>
      calculateAndCachePercentage(studentId, subjectId).catch(err =>
        logger.error('recalc failed', { studentId, subjectId, err })
      )
    ));
  }
  logger.info('attendance.recalculation.complete');
});
```
