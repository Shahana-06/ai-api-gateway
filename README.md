# AI-Powered API Gateway

A Node.js API gateway that uses LLM-based intent classification to route requests dynamically — instead of static URL rules.

## Architecture

```
Client → ALB → Node.js Gateway (×2 EC2) → FastAPI AI Service → Anthropic API
                      ↓             ↑
                   Redis        PostgreSQL
```

## Project Structure

```
ai-gateway/
├── gateway/        # Node.js + Express API gateway
├── ai-service/     # Python FastAPI AI/LLM service
└── docker-compose.yml
```

## Quick Start (local dev)

```bash
# 1. Clone and install
git clone <your-repo>
cd ai-gateway/gateway
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Start Postgres + Redis via Docker
docker-compose up -d postgres redis

# 4. Run migrations
npm run migrate

# 5. Start the gateway
npm run dev

# 6. Test health endpoint
curl http://localhost:3000/health
```

## Build Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Gateway skeleton, Postgres, Redis, /health | ✅ Done |
| 2 | JWT auth, register/login, API keys | ⬜ Next |
| 3 | FastAPI /classify endpoint | ⬜ |
| 4 | Gateway → FastAPI integration + routing | ⬜ |
| 5 | Upstream stub services | ⬜ |
| 6 | Redis token bucket rate limiting | ⬜ |
| 7 | Prompt injection middleware | ⬜ |
| 8 | Redis async job queue | ⬜ |
| 9 | Observability dashboard | ⬜ |
| 10 | AWS deployment | ⬜ |

## AWS SAA Concepts Used

- **EC2**: Gateway instances in private subnet, IAM role for RDS auth
- **ALB**: Public subnet, routes to target group, health checks on `/health`
- **RDS**: Postgres in private subnet, SG allows only EC2 SG on port 5432
- **ElastiCache**: Redis single node, private subnet
- **VPC**: Public subnet (ALB) + Private subnets (everything else)
- **IAM**: EC2 instance role, no hardcoded credentials
