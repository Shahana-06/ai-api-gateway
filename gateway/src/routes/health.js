/**
 * routes/health.js
 *
 * GET /health — liveness and readiness check.
 *
 * WHY THIS ENDPOINT EXISTS:
 *   The AWS Application Load Balancer pings this endpoint every 30 seconds
 *   on each EC2 instance. If it returns non-2xx, the ALB stops routing
 *   traffic to that instance. This protects users from being sent to a broken
 *   instance silently.
 *
 * LIVENESS vs READINESS:
 *   A liveness check answers "is the process alive?" — just return 200.
 *   A readiness check answers "is the process ready to serve traffic?" —
 *   you check dependencies too.
 *
 *   We implement readiness: we actively check Redis and Postgres. If either
 *   is unreachable, we return 503 so the ALB stops sending traffic here.
 *   This is the correct behaviour for a gateway — if the DB is down, there's
 *   no point sending requests to this instance.
 *
 * RESPONSE SHAPE (healthy):
 *   HTTP 200
 *   { "status": "ok", "uptime_s": 42.3, "checks": { "postgres": "ok", "redis": "ok" } }
 *
 * RESPONSE SHAPE (unhealthy):
 *   HTTP 503
 *   { "status": "degraded", "checks": { "postgres": "ok", "redis": "error: ..." } }
 */

const express                       = require('express');
const router                        = express.Router();
const { testConnection: pgTest }    = require('../config/database');
const { testConnection: redisTest } = require('../config/redis');

router.get('/health', async (req, res) => {
  const checks = { postgres: 'unchecked', redis: 'unchecked' };

  // Run both checks in parallel — no reason to wait for one before the other
  const [pgResult, redisResult] = await Promise.allSettled([
    pgTest(),
    redisTest(),
  ]);

  checks.postgres = pgResult.status    === 'fulfilled' ? 'ok' : `error: ${pgResult.reason?.message}`;
  checks.redis    = redisResult.status === 'fulfilled' ? 'ok' : `error: ${redisResult.reason?.message}`;

  const healthy = checks.postgres === 'ok' && checks.redis === 'ok';

  res.status(healthy ? 200 : 503).json({
    status:    healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_s:  Math.round(process.uptime() * 10) / 10,
    checks,
  });
});

module.exports = router;
