# Deployment Topology — Smart Attendance Tracker

## Component Inventory

| Component | Service | Tier | HA |
|---|---|---|---|
| React SPA | S3 + CloudFront | Frontend | Yes (CDN) |
| Node.js API | ECS Fargate | Application | Yes (2 AZs, auto-scaling) |
| MongoDB | MongoDB Atlas M10 | Database | Yes (replica set, 3 nodes) |
| Redis | ElastiCache (cluster mode) | Cache | Yes (primary + replica) |
| Email | AWS SES | External | Yes (AWS managed) |
| Secrets | AWS Secrets Manager | Security | Yes (AWS managed) |
| Load Balancer | ALB | Network | Yes (multi-AZ) |
| CDN | CloudFront | Network | Yes (global edge) |
| Container Registry | ECR | CI/CD | Yes (AWS managed) |
| CI/CD | GitHub Actions | DevOps | N/A |
| Monitoring | CloudWatch | Observability | Yes (AWS managed) |
| WAF | AWS WAF v2 | Security | Yes (AWS managed) |

## ECS Fargate Configuration

```
Cluster: sat-cluster
Service: sat-api-service

Task Definition: sat-api
  CPU:    512 (0.5 vCPU)
  Memory: 1024 MB (1 GB)
  Container:
    Image:  {account}.dkr.ecr.us-east-1.amazonaws.com/sat-api:latest
    Port:   3000
    Environment: (from Secrets Manager + SSM Parameter Store)
    HealthCheck: GET /health → 200 OK
    LogDriver: awslogs → /ecs/sat-api

Auto Scaling:
  Min tasks:    2 (one per AZ)
  Max tasks:    10
  Scale out:    CPU > 70% for 2 minutes
  Scale in:     CPU < 30% for 5 minutes
  Target:       ECS:ServiceAverageCPUUtilization = 60%
```

## MongoDB Atlas Configuration

```
Cluster: sat-cluster (M10 tier)
  Region:       AWS us-east-1
  Nodes:        3 (1 primary + 2 secondaries)
  Storage:      10 GB (auto-scaling enabled)
  Encryption:   At rest (AES-256, Atlas managed keys)
  TLS:          Required (TLS 1.2+)
  Network:      VPC Peering with application VPC
  Backup:       Continuous cloud backup, 7-day retention
  Indexes:      All indexes defined in Mongoose schemas
```

## ElastiCache Redis Configuration

```
Cluster: sat-redis
  Engine:       Redis 7.x
  Node type:    cache.t3.micro (dev) / cache.r6g.large (prod)
  Nodes:        1 primary + 1 replica (Multi-AZ)
  Encryption:   At rest (AWS managed) + In transit (TLS)
  Auth:         AUTH token required
  Subnets:      Private data subnets only
  Backup:       Daily snapshot, 1-day retention
```

## Scaling Strategy

```
Horizontal Scaling (ECS):
  - Stateless containers → scale freely
  - ALB distributes traffic round-robin
  - Auto-scaling based on CPU/memory metrics
  - Blue/green deployment via ECS rolling update

Vertical Scaling (MongoDB Atlas):
  - Atlas auto-scaling: storage scales automatically
  - Tier upgrade: M10 → M20 → M30 as needed

Cache Scaling (ElastiCache):
  - Redis cluster mode: add shards for write scaling
  - Read replicas: add replicas for read scaling
```

## Backup & Disaster Recovery

```
MongoDB Atlas:
  - Continuous backup: point-in-time recovery (PITR) up to 7 days
  - Snapshot: daily, retained 7 days
  - Cross-region backup: us-west-2 (secondary region)
  - RTO: < 4 hours | RPO: < 1 hour

ElastiCache:
  - Daily snapshot to S3
  - Retention: 1 day
  - RTO: < 30 minutes (restore from snapshot)

S3 (profile photos):
  - Versioning enabled
  - Cross-region replication to us-west-2
  - Lifecycle: transition to S3-IA after 90 days

Application:
  - ECS tasks are stateless — no backup needed
  - ECR images retained for 30 days (lifecycle policy)
  - Secrets Manager: automatic rotation every 90 days

DR Strategy:
  - Primary: us-east-1
  - Secondary: us-west-2 (warm standby)
  - Failover: Route 53 health checks → automatic DNS failover
  - RTO: < 2 hours | RPO: < 1 hour
```
