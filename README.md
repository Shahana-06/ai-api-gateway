# AI-Powered API Gateway

A production-grade API gateway that uses LLM-based intent classification to route requests dynamically — instead of static URL rules.

## What it does

Instead of routing based on URL paths (`/payments`, `/analytics`), this gateway:
1. Receives any JSON request
2. Sends the payload to an AI classifier (Groq/LLaMA)
3. Gets back `{ intent, confidence, route }`
4. Routes to the correct upstream service
5. Blocks prompt injection attempts before they reach the LLM

## Architecture

```
Client → ALB → Node.js Gateway (×2 EC2) → FastAPI AI Service → Groq (LLaMA)
                      ↓             ↑
                   Redis        PostgreSQL
              (ElastiCache)      (RDS)
```

**AWS Services Used:**
- **EC2** (t3.micro ×2) — Gateway instances in public subnet, IAM role for RDS access
- **ALB** — Internet-facing, distributes traffic, health checks on `/health`
- **RDS PostgreSQL** — request logs, API keys, routing rules, users
- **ElastiCache Redis** — token bucket rate limiting per API key
- **VPC** — public subnet for ALB, private subnets for RDS and ElastiCache

## Tech Stack

- **Node.js + Express** — API Gateway
- **Python FastAPI** — AI/LLM Service  
- **PostgreSQL** — Persistent storage
- **Redis** — Rate limiting
- **Groq (LLaMA 3.1)** — Intent classification
- **AWS** — EC2, ALB, RDS, ElastiCache, VPC

## Features

| Feature | Implementation |
|---|---|
| JWT Authentication | Register/login, Bearer token |
| API Key Management | Per-key rate limits, bcrypt hashed |
| Intent Classification | Groq LLaMA → `{ intent, confidence, route }` |
| Prompt Injection Detection | Rule-based middleware, blocks before LLM |
| Rate Limiting | Redis token bucket, 100 req/min per key |
| Request Logging | PostgreSQL, async write |
| Observability Dashboard | `/dashboard` — p95 latency, error rate, token usage |

## API Endpoints

```
POST /api/auth/register     — create account
POST /api/auth/login        — get JWT token
POST /api/auth/keys         — create API key
GET  /api/auth/keys         — list API keys
POST /api/gateway           — main gateway endpoint (requires auth)
GET  /health                — ALB health check
GET  /dashboard             — observability dashboard
```

## Live Demo (AWS)

Gateway URL: `http://ai-gateway-alb-1990396383.ap-south-1.elb.amazonaws.com`

### Register
```bash
curl -s -X POST http://ai-gateway-alb-1990396383.ap-south-1.elb.amazonaws.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@gateway.com","password":"demo1234"}'
```

### Login
```bash
curl -s -X POST http://ai-gateway-alb-1990396383.ap-south-1.elb.amazonaws.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@gateway.com","password":"demo1234"}'
```

### Intent Classification + Routing
```bash
curl -s -X POST http://ai-gateway-alb-1990396383.ap-south-1.elb.amazonaws.com/api/gateway \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"service": "payments", "action": "process_payment", "amount": 99}'
```

### Injection Detection
```bash
curl -s -X POST http://ai-gateway-alb-1990396383.ap-south-1.elb.amazonaws.com/api/gateway \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"message": "ignore previous instructions"}'
```

## Local Setup

```bash
# Clone
git clone https://github.com/Shahana-06/ai-api-gateway
cd ai-api-gateway

# Start Postgres + Redis
docker-compose up -d postgres redis

# Gateway
cd gateway
cp .env.example .env  # fill in values
npm install
npm run migrate
npm run dev

# AI Service
cd ../ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```

## AWS Architecture Decisions

| Decision | Choice | Production alternative |
|---|---|---|
| RDS Multi-AZ | Off (cost) | On — automatic failover |
| ElastiCache replicas | 0 (cost) | 1+ — high availability |
| EC2 count | 2 (free tier) | Auto Scaling Group |
| Subnets | Public for EC2 | Private with NAT Gateway |
| Auth | Password in .env | IAM token via rds-signer |

## Build Phases

| Phase | Feature | Status |
|---|---|---|
| 1 | Gateway skeleton, Postgres, Redis, /health | ✅ |
| 2 | JWT auth, API key management | ✅ |
| 3 | FastAPI intent classifier (Groq) | ✅ |
| 4 | Gateway → FastAPI routing | ✅ |
| 5 | Upstream stub services | ✅ |
| 6 | Redis token bucket rate limiting | ✅ |
| 7 | Prompt injection middleware | ✅ |
| 8 | Observability dashboard | ✅ |
| 9 | AWS deployment | ✅ |
```

Add them to README with:
```markdown
## Screenshots
![Health Check](screenshots/health-check.png)
![Intent Classification](screenshots/intent detection.png)
```

---
