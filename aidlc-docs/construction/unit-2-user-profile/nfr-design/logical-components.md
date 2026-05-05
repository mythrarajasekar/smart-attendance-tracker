# Logical Components — Unit 2: User & Profile Management

## Component Map

```
+------------------------------------------------------------------+
|                  USER UNIT LOGICAL COMPONENTS                    |
+------------------------------------------------------------------+
|                                                                  |
|  [Multer Upload Middleware]    [Sharp Image Processor]           |
|  memory storage                resize 400x400, webp             |
|  2MB limit, image/* only       quality 85                       |
|                                                                  |
|  [S3 Client]                   [Pre-signed URL Generator]       |
|  @aws-sdk/client-s3            getSignedUrl, 1h expiry          |
|  PutObject, DeleteObject       CloudFront alternative           |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [User Controller]                                               |
|  GET/PUT /users/me                                               |
|  POST /users/me/photo                                            |
|  POST/GET/PUT/DELETE /users, /users/:id                          |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [User Service]                                                  |
|  createUser()          getMyProfile()      updateMyProfile()     |
|  getUserById()         listUsers()         updateUser()          |
|  deactivateUser()      uploadPhoto()       searchUsers()         |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Profile Cache]             [User Model]                        |
|  Redis profile:{userId}      Mongoose schema                     |
|  TTL: 5 minutes              passwordHash: select false          |
|  Read-through pattern        auditLog: select false              |
|  Fail-open on miss           Text + compound indexes             |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Audit Logger]              [S3 Storage]                        |
|  Embedded auditLog array     AWS S3 / MinIO                      |
|  Append-only via $push       Private bucket                      |
|  Never exposed in API        Pre-signed URLs                     |
|                                                                  |
+------------------------------------------------------------------+
```

## Multer Configuration

```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});
```

## S3 Client Configuration

```typescript
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  // MinIO override for local development
  ...(process.env.S3_ENDPOINT ? {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  } : {}),
});
```
