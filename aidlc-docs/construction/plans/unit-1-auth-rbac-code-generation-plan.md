# Code Generation Plan — Unit 1: Authentication & RBAC

## Unit Context
- **Unit**: Unit 1 — Authentication & RBAC
- **Dependencies**: None (foundation unit)
- **Workspace Root**: /workspace (application code at root)
- **Project Type**: Greenfield monolith — structure: `src/{domain}/`

## Step Sequence

- [x] Step 1: Project structure setup (package.json, tsconfig, folder structure)
- [x] Step 2: Shared infrastructure (Redis client, logger, error classes, correlation ID middleware)
- [x] Step 3: auth.model.ts — User Mongoose schema with discriminator pattern
- [x] Step 4: auth.validation.ts — Joi schemas for login, refresh, logout
- [x] Step 5: auth.service.ts — Business logic (login, logout, refresh, brute-force)
- [x] Step 6: auth.middleware.ts — authenticate() and authorize() middleware
- [x] Step 7: auth.controller.ts — Express route handlers
- [x] Step 8: auth.routes.ts — Express router with rate limiters applied
- [x] Step 9: Frontend — authSlice.ts (Redux Toolkit)
- [x] Step 10: Frontend — axiosInstance.ts (token refresh interceptor)
- [x] Step 11: Frontend — LoginPage.tsx + LoginForm.tsx
- [x] Step 12: Frontend — ProtectedRoute.tsx
- [x] Step 13: Unit tests — auth.service.test.ts
- [x] Step 14: Unit tests — auth.middleware.test.ts
- [x] Step 15: PBT tests — auth.pbt.test.ts (fast-check)
- [x] Step 16: Integration tests — auth.integration.test.ts
- [x] Step 17: Code summary documentation
