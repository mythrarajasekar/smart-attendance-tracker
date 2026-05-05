# Tech Stack Decisions — Unit 4: Attendance Engine

| Component | Choice | Version | Rationale |
|---|---|---|---|
| Bulk write | MongoDB bulkWrite (Mongoose) | — | Idempotent upserts, single round trip for N records |
| Percentage cache | Redis (existing ioredis) | — | TTL 5 min, invalidated on every mark/edit |
| Background jobs | setImmediate (in-process) | built-in | Sufficient for v1; upgrade to Bull/BullMQ for distributed |
| Aggregation | MongoDB aggregation pipeline | — | Native, efficient for 1M records with proper indexes |
| Date handling | date-fns | 3.x | Immutable, tree-shakeable, timezone-safe date operations |

## Idempotent Bulk Write Strategy

```
Use $setOnInsert with upsert: true for each attendance record:
  { updateOne: {
      filter: { studentId, subjectId, sessionId },
      update: { $setOnInsert: { status, markedBy, markedAt, date, slot, isLocked: false } },
      upsert: true
    }
  }

Effect:
  - First submission: creates the record
  - Duplicate submission: filter matches, $setOnInsert is a no-op → no change
  - No error on duplicate → idempotent by design
  - Compound unique index provides additional safety net
```

## Background Recalculation Strategy

```
After bulk mark completes:
  setImmediate(async () => {
    for (const { studentId, subjectId } of affectedPairs) {
      await invalidatePercentageCache(studentId, subjectId);
      const pct = await calculatePercentage(studentId, subjectId);
      await alertService.checkAndAlert(studentId, subjectId, pct.percentage);
    }
  });

Why setImmediate:
  - Runs after current I/O event completes
  - Does not block the HTTP response
  - Simple, no external dependencies
  - Acceptable for v1 (single Node.js instance)

Future upgrade path:
  - Replace setImmediate with Bull job queue
  - Enables distributed processing across multiple instances
  - Provides retry logic and dead-letter queue
```
