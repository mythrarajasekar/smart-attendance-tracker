# NFR Design Patterns — Unit 3: Subject Management

## 1. MongoDB Compound Index Strategy

```typescript
// Ordered by query frequency and selectivity

// Uniqueness constraint
subjectSchema.index({ code: 1, academicYear: 1 }, { unique: true });

// Role-scoped list queries (most frequent)
subjectSchema.index({ facultyIds: 1, isActive: 1 });   // faculty subject list
subjectSchema.index({ studentIds: 1, isActive: 1 });   // student enrolled subjects

// Admin filter queries
subjectSchema.index({ department: 1, semester: 1, isActive: 1 });
subjectSchema.index({ academicYear: 1, isActive: 1 });

// Default sort
subjectSchema.index({ createdAt: -1 });

// Full-text search
subjectSchema.index(
  { name: 'text', code: 'text' },
  { weights: { code: 10, name: 5 }, name: 'subject_text_search' }
);

// Query → Index mapping:
// GET /subjects (faculty)    → { facultyIds, isActive }
// GET /subjects (student)    → { studentIds, isActive }
// GET /subjects?dept=CS      → { department, semester, isActive }
// GET /subjects?year=2024    → { academicYear, isActive }
// GET /subjects?search=algo  → text index
```

## 2. Bulk Write Optimization Pattern

```typescript
// Single bulkWrite for enrolling N students
async function bulkEnrollStudents(
  subjectId: string,
  validStudentIds: string[]
): Promise<void> {
  await SubjectModel.bulkWrite([
    {
      updateOne: {
        filter: { _id: subjectId },
        update: {
          $addToSet: { studentIds: { $each: validStudentIds } },
          $push: {
            auditLog: {
              changedBy: adminId,
              changedAt: new Date(),
              action: 'bulk_enrolled',
              details: { count: validStudentIds.length },
            },
          },
        },
      },
    },
  ]);
}

// Performance comparison:
// 1000 individual updates: ~1000 round trips × ~5ms = ~5 seconds
// 1 bulkWrite:             1 round trip × ~50ms  = ~50ms
```

## 3. CSV Streaming Parser Pattern

```typescript
import { parse } from 'csv-parse';
import { Readable } from 'stream';

async function parseEnrollmentCSV(buffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const rollNumbers: string[] = [];
    let rowCount = 0;

    const parser = parse({
      columns: true,           // use first row as headers
      skip_empty_lines: true,
      trim: true,
      max_record_size: 1000,
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        rowCount++;
        if (rowCount > 1000) {
          parser.destroy(new BusinessRuleError('CSV exceeds 1000 row limit', 'CSV_TOO_LARGE'));
          return;
        }
        if (!record.rollNumber) {
          reject(new ValidationError('CSV must have a rollNumber column'));
          return;
        }
        rollNumbers.push(record.rollNumber.trim());
      }
    });

    parser.on('error', reject);
    parser.on('end', () => resolve([...new Set(rollNumbers)])); // deduplicate

    Readable.from(buffer).pipe(parser);
  });
}
```

## 4. Redis Cache Strategy for Subjects

```typescript
// Cache key patterns:
//   subjects:{subjectId}           → single subject detail, TTL 300s
//   subjects:list:{queryHash}      → paginated list result, TTL 60s

// Cache invalidation triggers:
//   Create subject        → DEL subjects:list:* (pattern delete)
//   Update subject        → DEL subjects:{id}, DEL subjects:list:*
//   Assign/remove faculty → DEL subjects:{id}
//   Enroll/unenroll       → DEL subjects:{id}
//   Deactivate/reactivate → DEL subjects:{id}, DEL subjects:list:*

// Query hash generation (deterministic):
function hashQuery(query: SubjectSearchQuery): string {
  return crypto.createHash('md5')
    .update(JSON.stringify(query, Object.keys(query).sort()))
    .digest('hex');
}

// Pattern delete for list cache (Redis SCAN + DEL):
async function invalidateListCache(): Promise<void> {
  try {
    const keys = await redisClient.keys('subjects:list:*');
    if (keys.length > 0) await redisClient.del(...keys);
  } catch { /* non-critical */ }
}
```

## 5. Capacity Check Pattern (Race Condition Safe)

```typescript
// Problem: Two concurrent enrollment requests could both pass capacity check
// Solution: Use MongoDB atomic $addToSet with post-write validation
// OR: Use findOneAndUpdate with $where capacity check (MongoDB 4.4+)

// Approach: Optimistic — check before write, accept small race window
// Rationale: Admin-only operation, low concurrency, acceptable for v1
// Future: Use MongoDB transactions for strict capacity enforcement

async function checkCapacity(subject: ISubject, requestedCount: number): Promise<number> {
  if (subject.capacity === null) return requestedCount; // unlimited
  const current = subject.studentIds.length;
  const available = subject.capacity - current;
  return Math.min(requestedCount, available); // how many can be enrolled
}
```
