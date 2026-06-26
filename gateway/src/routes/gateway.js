/**
 * routes/gateway.js
 *
 * POST /api/gateway — the main entry point for all routed requests.
 *
 * Flow:
 *   1. Auth middleware already ran (req.user is set)
 *   2. Extract the request body
 *   3. Call FastAPI → get intent + route
 *   4. If injection detected → reject 400
 *   5. If unknown intent → reject 422
 *   6. Proxy to upstream → return response
 *   7. Log to Postgres
 */

const express            = require('express');
const router             = express.Router();
const { authenticate }   = require('../middleware/auth');
const { classifyIntent } = require('../services/intentService');
const { proxyToUpstream }= require('../services/proxyService');
const { pool }           = require('../config/database');
const { Errors }         = require('../utils/errors');
const logger             = require('../utils/logger');

router.post('/api/gateway', authenticate, async (req, res) => {
  const startTime = Date.now();

  // 1. Classify intent
  const classification = await classifyIntent(req.body);

  // 2. Block injections
  if (classification.injection_detected) {
    throw Errors.badRequest('Request blocked: prompt injection detected', 'INJECTION_DETECTED');
  }

  // 3. Reject unknown/low-confidence classifications
  if (classification.intent === 'unknown' || classification.confidence < 0.7) {
    throw Errors.badRequest(
      `Could not classify request intent (confidence: ${classification.confidence})`,
      'UNCLASSIFIABLE'
    );
  }

  // 4. Proxy to upstream
  const { status, data } = await proxyToUpstream(req, classification.route, classification.intent);

  const latency = Date.now() - startTime;

  // 5. Log to Postgres (await is fine at our scale)
  try {
    await pool.query(
      `INSERT INTO request_logs (req_id, user_id, intent, route, status_code, latency_ms, token_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.id,
        req.user.id,
        classification.intent,
        classification.route,
        status,
        latency,
        classification.tokens_used || 0,
      ]
    );
  } catch (dbErr) {
    // Log the error but don't fail the request — DB logging is non-critical
    logger.error({ dbErr }, '[gateway] Failed to write request log');
  }

  // 6. Return upstream response to client, enriched with gateway metadata
  res.status(status).json({
    success: true,
    meta: {
      intent:     classification.intent,
      confidence: classification.confidence,
      latency_ms: latency,
    },
    data,
  });
});

module.exports = router;