# Tech Stack Decisions — Unit 3: Subject Management

| Component | Choice | Version | Rationale |
|---|---|---|---|
| CSV parser | csv-parse | 5.x | Streaming API, handles large files without full memory load |
| Bulk write | MongoDB bulkWrite | (Mongoose) | Atomic batch operations, better performance than individual writes |
| Subject cache | Redis (existing ioredis) | — | Reuse Unit 1 client; subject list TTL 60s, detail TTL 300s |
| Cache key hashing | Node.js crypto.createHash | built-in | Deterministic cache keys for query parameter combinations |

## Bulk Write Strategy

```
For enrollment of N students:
  - Validate all studentIds against DB first (one $in query)
  - Separate: valid new, already enrolled, not found, capacity exceeded
  - Single bulkWrite with $addToSet: { $each: validIds }
  - One audit log entry for the entire batch (not per-student)
  - Return detailed EnrollmentResult

Why not individual updates:
  - N individual findByIdAndUpdate calls = N round trips
  - Single bulkWrite = 1 round trip regardless of N
  - Critical for 1000-student batch performance target
```

## CSV Streaming Strategy

```
csv-parse streaming API:
  - pipe(fs.createReadStream) or pipe(Readable.from(buffer))
  - Process rows as they arrive (no full-file memory load)
  - Collect rollNumbers into array (max 1000)
  - After stream ends: batch DB lookup by rollNumber
  - Single UserModel.find({ rollNumber: { $in: rollNumbers } })
  - Map rollNumber → studentId
  - Call enrollStudents() with found IDs
```
