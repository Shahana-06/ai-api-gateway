# VPC Architecture Notes

## Subnet Layout

```
VPC: 10.0.0.0/16

Public Subnets  (ALB lives here):      10.0.1.0/24 (AZ-a), 10.0.2.0/24 (AZ-b)
Private Subnets (EC2/RDS/Redis here):  10.0.10.0/24 (AZ-a), 10.0.11.0/24 (AZ-b)
```

## Security Group Rules

### ALB SG: inbound 443 from 0.0.0.0/0 → outbound 3000 to gateway-sg
### Gateway SG: inbound 3000 from alb-sg → outbound 5432 to rds-sg, 6379 to redis-sg, 443 to internet (Anthropic)
### RDS SG: inbound 5432 from gateway-sg only
### Redis SG: inbound 6379 from gateway-sg only

## IAM Role on EC2 (ec2-gateway-role)
Grants rds-db:connect to this instance. No passwords needed in .env for production.

## Trade-offs Documented
| Decision | Dev choice | Production choice |
|---|---|---|
| RDS Multi-AZ | Off (cost) | On — auto failover |
| Redis cluster | Off | On — hash slots |
| Auth | Password in .env | IAM token via rds-signer |
| EC2 scaling | 2 manual instances | Auto Scaling Group |
