# NFR Design Patterns — Unit 2: User & Profile Management

## 1. MongoDB Indexing Strategy

```typescript
// Compound indexes ordered by selectivity (most selective first)

// Primary lookup indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ rollNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });

// Admin list queries: role + active status (covers most admin list calls)
userSchema.index({ role: 1, isActive: 1 });

// Department-scoped queries (reports, enrollment)
userSchema.index({ department: 1, role: 1, isActive: 1 });

// Student academic year filtering
userSchema.index({ academicYear: 1, role: 1, isActive: 1 });

// Default sort for paginated lists
userSchema.index({ createdAt: -1 });

// Full-text search (name, email, rollNumber, employeeId)
userSchema.index(
  { name: 'text', email: 'text', rollNumber: 'text', employeeId: 'text' },
  { weights: { name: 10, rollNumber: 8, employeeId: 8, email: 5 }, name: 'user_text_search' }
);

// Index usage by query pattern:
// GET /users?role=student&isActive=true          → { role, isActive }
// GET /users?department=CS&role=student          → { department, role, isActive }
// GET /users?search=john                         → text index
// GET /users?academicYear=2024-2025&role=student → { academicYear, role, isActive }
// GET /users/:id                                 → _id (default)
```

## 2. Profile Cache Strategy (Read-Through with TTL)

```typescript
// Cache key: profile:{userId}
// TTL: 300 seconds (5 minutes)
// Eviction: Redis allkeys-lru (configured at Redis level)

async function getCachedProfile(userId: string): Promise<UserProfile | null> {
  try {
    const cached = await redisClient.get(`profile:${userId}`);
    if (cached) return JSON.parse(cached);
  } catch {
    // Cache miss on Redis failure — fall through to DB
    logger.warn('Redis cache unavailable, falling back to MongoDB', { userId });
  }
  return null;
}

async function setCachedProfile(userId: string, profile: UserProfile): Promise<void> {
  try {
    await redisClient.set(`profile:${userId}`, JSON.stringify(profile), 'EX', 300);
  } catch {
    // Non-critical — log and continue
    logger.warn('Failed to cache profile', { userId });
  }
}

async function invalidateProfileCache(userId: string): Promise<void> {
  try {
    await redisClient.del(`profile:${userId}`);
  } catch {
    logger.warn('Failed to invalidate profile cache', { userId });
  }
}
```

## 3. Profile Image Storage Pattern

```typescript
// Upload flow with rollback safety
async function uploadProfilePhoto(userId: string, file: Express.Multer.File): Promise<string> {
  // Step 1: Validate and process image
  const processed = await sharp(file.buffer)
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();

  // Step 2: Generate unique key
  const key = `profiles/${userId}/${uuidv4()}.webp`;

  // Step 3: Upload to S3 (fail fast — do not update DB if this fails)
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: processed,
    ContentType: 'image/webp',
    // No public ACL — access via pre-signed URLs
  }));

  // Step 4: Generate pre-signed URL
  const url = await getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  }), { expiresIn: 3600 });

  // Step 5: Update DB (only after successful S3 upload)
  const user = await UserModel.findById(userId).select('profilePhotoKey');
  const oldKey = user?.profilePhotoKey;

  await UserModel.findByIdAndUpdate(userId, {
    $set: { profilePhotoUrl: url, profilePhotoKey: key },
    $push: { auditLog: { changedBy: userId, action: 'photo_uploaded', changedAt: new Date(), fields: ['profilePhotoUrl'], previousValues: { profilePhotoKey: oldKey } } }
  });

  // Step 6: Delete old photo (non-blocking — failure does not affect response)
  if (oldKey) {
    s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: oldKey }))
      .catch(err => logger.warn('Failed to delete old profile photo', { oldKey, err }));
  }

  return url;
}
```

## 4. Optimistic Concurrency Pattern

```typescript
// Pattern: read version → update with version check → retry on conflict
async function updateWithOptimisticConcurrency(
  userId: string,
  updates: Partial<IUser>,
  auditEntry: ProfileAuditEntry,
  maxRetries = 3
): Promise<IUser> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const current = await UserModel.findById(userId).select('+__v');
    if (!current) throw new NotFoundError('User');

    const result = await UserModel.findOneAndUpdate(
      { _id: userId, __v: current.__v },  // version check
      {
        $set: updates,
        $inc: { __v: 1 },
        $push: { auditLog: auditEntry }
      },
      { new: true, select: '-passwordHash -auditLog' }
    );

    if (result) return result;
    // Version mismatch — another request modified the document
    if (attempt === maxRetries - 1) throw new ConflictError('CONCURRENT_MODIFICATION', 'Profile was modified by another request. Please retry.');
    // Brief backoff before retry
    await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
  }
  throw new ConflictError('CONCURRENT_MODIFICATION', 'Could not update profile after retries');
}
```

## 5. Search Performance Pattern

```typescript
// Two-phase search: text index for keyword search, compound index for filters
function buildSearchQuery(filters: UserSearchQuery): FilterQuery<IUser> {
  const query: FilterQuery<IUser> = { isActive: filters.isActive ?? true };

  if (filters.role) query.role = filters.role;
  if (filters.department) query.department = filters.department;
  if (filters.academicYear) query.academicYear = filters.academicYear;

  if (filters.search) {
    // Use MongoDB text index for full-text search
    // Falls back to regex if text index not available
    query.$text = { $search: filters.search };
  }

  return query;
}

// Projection: exclude heavy fields from list queries
const LIST_PROJECTION = '-passwordHash -auditLog -profilePhotoKey -parentContact';
```
