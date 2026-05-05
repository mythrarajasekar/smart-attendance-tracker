# Integration Test Instructions — Smart Attendance Tracker

## Prerequisites

Integration tests require running MongoDB and Redis instances.

```bash
# Start test infrastructure
docker-compose up -d mongo redis

# Wait for services to be healthy
docker-compose ps
```

## Run All Integration Tests

```bash
# Set test environment variables
export NODE_ENV=test
export MONGODB_URI=mongodb://localhost:27017/sat_test
export REDIS_HOST=localhost
export REDIS_PORT=6379
export JWT_SECRET=test-secret-32-bytes-minimum-length!!
export JWT_REFRESH_SECRET=test-refresh-secret-32-bytes-min!!
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export S3_BUCKET=test-bucket

# Run integration tests
npm run test:integration
```

## Run by Module

```bash
npx jest src/modules/auth/__tests__/auth.integration.test.ts
npx jest src/modules/users/__tests__/user.integration.test.ts
npx jest src/modules/subjects/__tests__/subject.integration.test.ts
npx jest src/modules/attendance/__tests__/attendance.integration.test.ts
npx jest src/modules/notifications/__tests__/notification.integration.test.ts
```

## Integration Test Coverage

| Test File | Endpoints Covered |
|---|---|
| auth.integration | POST /auth/login, /refresh, /logout |
| user.integration | GET /users/me, POST /users, DELETE /users/:id |
| subject.integration | POST /subjects, GET /subjects, duplicate code |
| attendance.integration | POST /attendance, GET /student/:id |
| notification.integration | GET /notifications, PUT /read-all |

## End-to-End Flow Test (Manual)

```bash
# 1. Start full stack
docker-compose up -d

# 2. Create admin user (seed script)
npm run seed:admin

# 3. Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin123!"}'

# 4. Create a student
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"Student123!","role":"student","name":"Test Student","rollNumber":"CS001","department":"Computer Science","yearSemester":"1st Sem","academicYear":"2024-2025"}'

# 5. Create a subject and enroll student
# ... (follow API contracts in application-design.md)

# 6. Mark attendance as faculty
# 7. Verify percentage calculation
# 8. Verify alert trigger (set threshold to 100% to force alert)
# 9. Download report
```
