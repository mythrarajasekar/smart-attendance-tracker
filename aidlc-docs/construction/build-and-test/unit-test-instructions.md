# Unit Test Instructions — Smart Attendance Tracker

## Run All Unit Tests

```bash
# Run all unit tests (service + middleware + PBT)
npm run test:unit

# With coverage report
npm run test:unit -- --coverage

# Watch mode (development)
npm run test:unit -- --watch
```

## Run Tests by Module

```bash
# Auth module
npx jest src/modules/auth/__tests__/auth.service.test.ts
npx jest src/modules/auth/__tests__/auth.middleware.test.ts
npx jest src/modules/auth/__tests__/auth.pbt.test.ts

# User module
npx jest src/modules/users/__tests__/user.service.test.ts
npx jest src/modules/users/__tests__/user.pbt.test.ts

# Subject module
npx jest src/modules/subjects/__tests__/subject.service.test.ts
npx jest src/modules/subjects/__tests__/subject.pbt.test.ts

# Attendance module
npx jest src/modules/attendance/__tests__/attendance.service.test.ts
npx jest src/modules/attendance/__tests__/attendance.pbt.test.ts

# Report module
npx jest src/modules/reports/__tests__/report.service.test.ts
npx jest src/modules/reports/__tests__/report.pbt.test.ts

# Notification module
npx jest src/modules/notifications/__tests__/notification.service.test.ts
npx jest src/modules/notifications/__tests__/notification.pbt.test.ts
```

## PBT Seed Logging (PBT-08 Compliance)

fast-check logs the seed on every run. To reproduce a failing test:

```bash
# Run with verbose output to see seed
npx jest src/modules/auth/__tests__/auth.pbt.test.ts --verbose

# Reproduce with specific seed (from failure output)
# In test file, add: fc.assert(fc.property(...), { seed: 1234567890 })
```

## Coverage Thresholds

| Metric | Threshold |
|---|---|
| Branches | 70% |
| Functions | 80% |
| Lines | 80% |
| Statements | 80% |

```bash
# Check coverage thresholds
npm run test:coverage
# Fails if any threshold is not met
```

## Expected Test Counts

| Module | Unit Tests | PBT Tests |
|---|---|---|
| Auth | 8 | 5 properties |
| Users | 5 | 4 properties |
| Subjects | 5 | 5 properties |
| Attendance | 6 | 6 properties |
| Reports | 5 | 4 properties |
| Notifications | 6 | 4 properties |
| **Total** | **35+** | **28 properties** |
