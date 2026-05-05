# Build Instructions — Smart Attendance Tracker

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20.11.1 LTS | https://nodejs.org |
| npm | 10.x | Bundled with Node.js |
| Docker | 24.x+ | https://docs.docker.com/get-docker/ |
| Docker Compose | 2.x+ | Bundled with Docker Desktop |
| AWS CLI | 2.x | https://aws.amazon.com/cli/ (production only) |

## Local Development Build

```bash
# 1. Clone repository
git clone https://github.com/org/smart-attendance-tracker.git
cd smart-attendance-tracker

# 2. Install dependencies (exact versions from lock file)
npm ci --frozen-lockfile

# 3. Copy environment file and fill in values
cp .env.example .env
# Edit .env with your local values

# 4. Start infrastructure services (MongoDB, Redis, MinIO)
docker-compose up -d mongo redis minio

# 5. TypeScript type check
npm run type-check

# 6. Start development server (hot reload)
npm run dev
# Server starts at http://localhost:3000
# Health check: http://localhost:3000/health
```

## Production Docker Build

```bash
# Build production Docker image
docker build -t sat-api:latest .

# Verify image
docker run --rm sat-api:latest node --version

# Run with docker-compose (full stack)
docker-compose up -d

# Verify all services healthy
docker-compose ps
docker-compose logs api --tail=50
```

## TypeScript Compilation

```bash
# Compile TypeScript to JavaScript
npm run build

# Output: dist/ directory
# Verify: ls dist/
```

## Frontend Build

```bash
cd src/frontend

# Install frontend dependencies
npm ci --frozen-lockfile

# Build React app for production
npm run build

# Output: src/frontend/build/
# Deploy to S3: aws s3 sync build/ s3://sat-frontend-prod/ --delete
```

## ECR Push (Production)

```bash
# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t sat-api:$GIT_SHA .
docker tag sat-api:$GIT_SHA \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/sat-api:$GIT_SHA

# Push
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/sat-api:$GIT_SHA
```
