# Network Architecture — Smart Attendance Tracker (AWS)

## VPC Layout

```
AWS Region: us-east-1 (primary)

VPC: 10.0.0.0/16
  |
  +── Public Subnets (2 AZs)
  |     10.0.1.0/24  (us-east-1a)  ← ALB, NAT Gateway
  |     10.0.2.0/24  (us-east-1b)  ← ALB, NAT Gateway
  |
  +── Private App Subnets (2 AZs)
  |     10.0.11.0/24 (us-east-1a)  ← ECS Tasks (Node.js containers)
  |     10.0.12.0/24 (us-east-1b)  ← ECS Tasks (Node.js containers)
  |
  +── Private Data Subnets (2 AZs)
        10.0.21.0/24 (us-east-1a)  ← ElastiCache Redis
        10.0.22.0/24 (us-east-1b)  ← ElastiCache Redis
```

## Traffic Flow

```
Internet
    |
    v
[Route 53] ──── DNS: api.attendance.edu → ALB
                DNS: attendance.edu     → CloudFront
    |
    v
[CloudFront] ── Origin: S3 bucket (React SPA)
    |           HTTPS only, TLS 1.2+
    |           WAF attached
    v
[S3 Bucket] ── Static React build (private, CloudFront OAC)
    |
    v
[WAF (Web ACL)] ── Rate limiting, SQL injection, XSS rules
    |
    v
[Application Load Balancer] ── HTTPS:443 only
    |                          HTTP:80 → redirect to HTTPS
    |                          SSL cert: ACM
    v
[ECS Fargate Tasks] ── Node.js API containers
    |                  Private subnets only
    |                  No direct internet access
    v
[VPC Endpoints / NAT Gateway]
    |
    +── MongoDB Atlas (VPC Peering or Private Link)
    +── ElastiCache Redis (private subnet)
    +── AWS SES (via VPC endpoint or NAT)
    +── AWS Secrets Manager (VPC endpoint)
    +── S3 (VPC endpoint for profile photos)
    +── CloudWatch Logs (VPC endpoint)
```

## Security Groups

```
sg-alb (Application Load Balancer):
  Inbound:  443 from 0.0.0.0/0 (HTTPS)
            80  from 0.0.0.0/0 (redirect to HTTPS)
  Outbound: 3000 to sg-ecs (API port)

sg-ecs (ECS Tasks):
  Inbound:  3000 from sg-alb only
  Outbound: 27017 to MongoDB Atlas CIDR (VPC peering)
            6379  to sg-redis
            443   to 0.0.0.0/0 (SES, Secrets Manager via NAT/VPC endpoint)

sg-redis (ElastiCache):
  Inbound:  6379 from sg-ecs only
  Outbound: (none)
```

## DNS & TLS

```
Route 53:
  attendance.edu        → CloudFront distribution (A alias)
  api.attendance.edu    → ALB (A alias)
  www.attendance.edu    → redirect to attendance.edu

ACM Certificate:
  *.attendance.edu      → wildcard cert, auto-renewed
  Attached to: ALB + CloudFront

TLS Policy:
  ALB: ELBSecurityPolicy-TLS13-1-2-2021-06 (TLS 1.2+ only)
  CloudFront: TLSv1.2_2021
```
