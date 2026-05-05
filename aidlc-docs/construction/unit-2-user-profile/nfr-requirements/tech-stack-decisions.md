# Tech Stack Decisions — Unit 2: User & Profile Management

| Component | Choice | Version | Rationale |
|---|---|---|---|
| File upload middleware | Multer | 1.x | Standard Express multipart handler, memory storage for S3 pipe |
| Image processing | Sharp | 0.33.x | Validate dimensions, resize, convert format before S3 upload |
| S3 client | @aws-sdk/client-s3 | 3.x | AWS SDK v3, modular, tree-shakeable, supports pre-signed URLs |
| S3-compatible storage | AWS S3 / MinIO | — | MinIO for local dev, AWS S3 for production |
| Profile cache | Redis (existing ioredis client) | — | Reuse Unit 1 Redis client, TTL 5 minutes |
| Optimistic concurrency | Mongoose __v (versionKey) | — | Built-in Mongoose feature, no extra library |
| Text search | MongoDB text index | — | Built-in, sufficient for 10k users; Elasticsearch if scale requires |
| Pagination | Manual skip/limit | — | Simple, predictable; cursor-based pagination as future enhancement |

## S3 Storage Strategy

```
Bucket structure:
  {bucket}/profiles/{userId}/{uuid}.{ext}

Access control:
  Bucket: Block all public access
  Object ACL: private
  Access method: Pre-signed GET URLs (1-hour expiry) OR CloudFront signed URLs

Pre-signed URL generation:
  GetObjectCommand → getSignedUrl(s3Client, command, { expiresIn: 3600 })
  URL stored in profilePhotoUrl field (refreshed on each profile fetch)

Local development:
  MinIO running in Docker, same S3 API
  MINIO_ENDPOINT env var overrides AWS endpoint
```

## Optimistic Concurrency Strategy

```
Mongoose versionKey (__v):
  - Automatically incremented on every save/update
  - Used in findOneAndUpdate filter: { _id: userId, __v: currentVersion }
  - If document was modified by another request between read and write:
    → findOneAndUpdate returns null (no match)
    → Service throws ConflictError('CONCURRENT_MODIFICATION')
  - Client retries by re-fetching and re-applying changes
```
