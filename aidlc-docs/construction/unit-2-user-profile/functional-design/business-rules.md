# Business Rules — Unit 2: User & Profile Management

## Access Control Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-USER-01 | Only Admin can create user accounts | authorize(['admin']) on POST /users |
| BR-USER-02 | Only Admin can deactivate/reactivate users | authorize(['admin']) on DELETE /users/:id |
| BR-USER-03 | Only Admin can update any user's account | authorize(['admin']) on PUT /users/:id |
| BR-USER-04 | Any authenticated user can view and update their own profile | GET/PUT /users/me |
| BR-USER-05 | Admin cannot deactivate their own account | targetUserId === adminId → reject |
| BR-USER-06 | Faculty can only view profiles of students enrolled in their subjects | Enforced in SubjectService (Unit 3) |

## Field-Level Access Rules

| ID | Rule | Student | Faculty | Admin |
|---|---|---|---|---|
| BR-USER-07 | Can update name | ✅ | ✅ | ✅ |
| BR-USER-08 | Can update phone | ✅ | ✅ | ✅ |
| BR-USER-09 | Can update parentContact | ✅ | ❌ | ✅ |
| BR-USER-10 | Can update designation | ❌ | ✅ | ✅ |
| BR-USER-11 | Can update yearSemester | ✅ | ❌ | ✅ |
| BR-USER-12 | Can update profilePhotoUrl | ✅ | ✅ | ✅ |
| BR-USER-13 | Cannot update rollNumber | ❌ (immutable) | N/A | ✅ |
| BR-USER-14 | Cannot update department | ❌ (immutable) | ❌ (immutable) | ✅ |
| BR-USER-15 | Cannot update email | ❌ | ❌ | ✅ |
| BR-USER-16 | Cannot update role | ❌ | ❌ | ✅ |

## Data Integrity Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-USER-17 | Email must be unique across all users | Unique MongoDB index + ConflictError |
| BR-USER-18 | Roll number must be unique across all students | Sparse unique index + ConflictError |
| BR-USER-19 | Employee ID must be unique across all faculty | Sparse unique index + ConflictError |
| BR-USER-20 | Deletion is always soft (isActive: false) — no hard deletes | No DELETE with remove() — only findOneAndUpdate |
| BR-USER-21 | Deactivated users cannot log in | Checked in AuthService.login() |
| BR-USER-22 | Deactivating a user invalidates all their active tokens | Redis blacklist + refresh token deletion |

## Audit Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-USER-23 | Every profile creation is logged in auditLog | Embedded auditLog array on User document |
| BR-USER-24 | Every profile update logs changed fields and previous values | previousValues captured before update |
| BR-USER-25 | Every deactivation/reactivation is logged | action: 'deactivated' / 'reactivated' in auditLog |
| BR-USER-26 | Every photo upload/deletion is logged | action: 'photo_uploaded' / 'photo_deleted' |
| BR-USER-27 | Audit log is never returned in API responses | select('-auditLog') on all queries |
| BR-USER-28 | Audit log is append-only — no entries are ever deleted | $push only, no $pull on auditLog |

## Photo Upload Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-USER-29 | Allowed MIME types: image/jpeg, image/png, image/webp | Multer + server-side MIME validation |
| BR-USER-30 | Maximum file size: 2 MB | Multer limits.fileSize |
| BR-USER-31 | Old photo is deleted from S3 when a new one is uploaded | DeleteObjectCommand before PutObjectCommand |
| BR-USER-32 | Photo URLs are private (not public S3 ACL) | Pre-signed URLs or CloudFront signed URLs |

## Pagination Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-USER-33 | Default page size: 20 | Joi default value |
| BR-USER-34 | Maximum page size: 100 | Joi max validation |
| BR-USER-35 | Page is 1-based | (page - 1) * limit for skip calculation |
| BR-USER-36 | Search is case-insensitive | $regex with $options: 'i' |

## PBT Properties (Partial Mode)

| Property | Category | Description |
|---|---|---|
| PBT-USER-01 | Invariant | Paginated results total never exceeds actual document count |
| PBT-USER-02 | Invariant | Page * limit + remaining = total (pagination math) |
| PBT-USER-03 | Invariant | Soft-deleted user never appears in isActive:true queries |
| PBT-USER-04 | Round-trip | User create → get by ID returns identical non-sensitive fields |
| PBT-USER-05 | Invariant | auditLog length only increases, never decreases |
