# Code Generation Plan — Unit 2: User & Profile Management

## Unit Context
- **Unit**: Unit 2 — User & Profile Management
- **Dependencies**: Unit 1 (auth.middleware, auth.model, shared errors/logger/redis)
- **Workspace Root**: /workspace

## Steps

- [x] Step 1: user.model.ts — Extended User schema with audit log, indexes, S3 fields
- [x] Step 2: user.validation.ts — Joi schemas for create, update, search
- [x] Step 3: user.service.ts — Business logic with cache, optimistic concurrency, S3
- [x] Step 4: user.controller.ts — Route handlers
- [x] Step 5: user.routes.ts — Router with auth middleware + multer
- [x] Step 6: Frontend — userSlice.ts
- [x] Step 7: Frontend — UserTable.tsx + SearchFilters.tsx
- [x] Step 8: Frontend — StudentProfile.tsx + FacultyProfile.tsx
- [x] Step 9: Frontend — AdminUserManagement.tsx
- [x] Step 10: Unit tests — user.service.test.ts
- [x] Step 11: PBT tests — user.pbt.test.ts
- [x] Step 12: Integration tests — user.integration.test.ts
- [x] Step 13: Code summary
