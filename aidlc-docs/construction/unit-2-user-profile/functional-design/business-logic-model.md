# Business Logic Model — Unit 2: User & Profile Management

## 1. Create User (Admin Only)

```
INPUT: CreateUserDto, adminId (from req.user)

Step 1: Validate role-specific required fields
        Student: rollNumber, department, yearSemester, academicYear required
        Faculty: employeeId, department required
        Admin:   no extra fields required

Step 2: Check email uniqueness → UserModel.findOne({ email })
        IF exists → throw ConflictError('DUPLICATE_EMAIL')

Step 3: Check role-specific uniqueness
        Student: check rollNumber uniqueness
        Faculty: check employeeId uniqueness

Step 4: Hash password → bcrypt.hash(password, BCRYPT_ROUNDS)

Step 5: Create user document with:
        isActive: true
        auditLog: [{ changedBy: adminId, action: 'created', changedAt: now, fields: ['all'], previousValues: {} }]

Step 6: Return sanitized UserProfile (no passwordHash)

Step 7: Log audit event to Winston
```

## 2. Get Own Profile (Any Authenticated User)

```
INPUT: userId (from req.user)

Step 1: Check Redis cache → GET profile:{userId}
        IF hit → return parsed profile

Step 2: UserModel.findById(userId).select('-passwordHash -auditLog')
        IF not found → throw NotFoundError('User')

Step 3: SET profile:{userId} = JSON.stringify(profile), EX 300 (5 minutes)

Step 4: Return profile
```

## 3. Update Own Profile (Role-Scoped Fields)

```
INPUT: userId, role (from req.user), UpdateProfileDto

Step 1: Validate allowed fields by role:
        Student:  name, phone, parentContact, profilePhotoUrl, profilePhotoKey, yearSemester
        Faculty:  name, phone, designation, profilePhotoUrl, profilePhotoKey
        Admin:    name, phone
        REJECT any field not in allowed list → throw BusinessRuleError('FORBIDDEN_FIELD')

Step 2: Load current document with optimistic concurrency version:
        UserModel.findById(userId).select('+__v')
        Capture previousValues for changed fields

Step 3: Apply updates using findOneAndUpdate with version check:
        { _id: userId, __v: currentVersion }
        { $set: updates, $inc: { __v: 1 }, $push: { auditLog: auditEntry } }
        IF no document matched → throw ConflictError('CONCURRENT_MODIFICATION')

Step 4: Invalidate Redis cache → DEL profile:{userId}

Step 5: Return updated profile
```

## 4. Admin Update Any User

```
INPUT: targetUserId, adminId, AdminUpdateUserDto

Step 1: Validate target user exists and is not the admin themselves
        (admins cannot deactivate themselves)

Step 2: Capture previousValues for audit

Step 3: Apply updates with optimistic concurrency (same as step 3 above)
        Append audit entry: { changedBy: adminId, action: 'updated', fields: [...] }

Step 4: Invalidate Redis cache → DEL profile:{targetUserId}

Step 5: Return updated profile
```

## 5. Deactivate User (Soft Delete — Admin Only)

```
INPUT: targetUserId, adminId

Step 1: Load user → validate exists and isActive === true
        IF already inactive → throw BusinessRuleError('USER_ALREADY_INACTIVE')

Step 2: Admin cannot deactivate themselves
        IF targetUserId === adminId → throw BusinessRuleError('CANNOT_DEACTIVATE_SELF')

Step 3: findOneAndUpdate:
        { $set: { isActive: false }, $push: { auditLog: { action: 'deactivated', changedBy: adminId } } }

Step 4: Invalidate Redis cache → DEL profile:{targetUserId}

Step 5: Invalidate all active tokens for the user:
        SET blacklist:{userId}:all = '1', EX 604800 (7 days)
        DEL refresh:{targetUserId}
        (authMiddleware checks this key as a secondary blacklist)

Step 6: Return { message: 'User deactivated' }
```

## 6. Profile Photo Upload Flow

```
INPUT: userId, file (multipart), role

Step 1: Validate file:
        MIME type: image/jpeg | image/png | image/webp
        Max size: 2 MB
        Min dimensions: 100x100px (validated server-side via sharp)

Step 2: Generate S3 object key:
        key = `profiles/${userId}/${uuidv4()}.${ext}`

Step 3: Upload to S3-compatible storage (AWS S3 / MinIO):
        PutObjectCommand({ Bucket, Key: key, Body: buffer, ContentType: mimeType, ACL: 'private' })

Step 4: Generate pre-signed URL (valid 1 hour) OR store CloudFront URL

Step 5: Delete old photo if exists:
        IF user.profilePhotoKey → DeleteObjectCommand({ Bucket, Key: oldKey })

Step 6: Update user document:
        { profilePhotoUrl: newUrl, profilePhotoKey: key }
        Append audit entry: { action: 'photo_uploaded' }

Step 7: Invalidate Redis cache → DEL profile:{userId}

Step 8: Return { profilePhotoUrl: newUrl }
```

## 7. Search & Pagination Flow

```
INPUT: UserSearchQuery (role, department, academicYear, isActive, search, page, limit, sortBy, sortOrder)

Step 1: Build MongoDB query filter:
        Base: { isActive: filter.isActive ?? true }
        IF role: { role: filter.role }
        IF department: { department: filter.department }
        IF academicYear: { academicYear: filter.academicYear }
        IF search: { $text: { $search: filter.search } }
          OR fallback: { $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { rollNumber: { $regex: search, $options: 'i' } },
            { employeeId: { $regex: search, $options: 'i' } }
          ]}

Step 2: Count total matching documents (for pagination metadata)

Step 3: Execute paginated query:
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .select('-passwordHash -auditLog')

Step 4: Return PaginatedUsers { data, total, page, limit, totalPages }
```
