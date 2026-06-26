/**
 * middleware/rateLimiter.js
 *
 * Token bucket rate limiter using Redis.
 *
 * TOKEN BUCKET ALGORITHM:
 *   - Each API key has a "bucket" with a max capacity (rate_limit_rpm)
 *   - The bucket refills at rate: capacity / 60 tokens per second
 *   - Each request costs 1 token
 *   - If the bucket is empty → 429
 *   - If the bucket has tokens → allow and decrement
 *
 * WHY TOKEN BUCKET OVER FIXED WINDOW:
 *   Fixed window (count requests per minute) has a edge case: a client can
 *   send 100 requests at 00:59 and 100 more at 01:01 — 200 requests in
 *   2 seconds. Token bucket prevents this by tracking tokens continuously.
 *
 * RACE CONDITION NOTE:
 *   With two gateway instances, two requests can read the same token count
 *   simultaneously and both decrement — briefly allowing one extra request.
 *   This is acceptable for a portfolio project. Production fix: Lua script
 *   for atomic read-modify-write (documented in infra/vpc-notes.md).
 */

const { redis }  = require('../config/redis');
const { Errors } = require('../utils/errors');
const logger     = require('../utils/logger');

async function rateLimiter(req, res, next) {
  // Rate limiting only applies to authenticated requests
  // auth middleware runs before this and sets req.user + req.apiKeyId
  if (!req.apiKeyId) return next();

  const capacity   = req.rateLimitRpm || 100; // set by auth middleware
  const refillRate = capacity / 60;            // tokens per second
  const key        = `ratelimit:${req.apiKeyId}`;

  // ── Read current bucket state ──────────────────────────────────────────────
  const raw = await redis.get(key);
  const now = Date.now();

  let tokens;
  let lastRefill;

  if (!raw) {
    // First request from this key — start with a full bucket
    tokens     = capacity;
    lastRefill = now;
  } else {
    const state = JSON.parse(raw);
    tokens      = state.tokens;
    lastRefill  = state.lastRefill;
  }

  // ── Refill tokens based on time elapsed ───────────────────────────────────
  const elapsed       = (now - lastRefill) / 1000; // seconds since last request
  const tokensToAdd   = elapsed * refillRate;
  tokens = Math.min(capacity, tokens + tokensToAdd); // cap at capacity

  // ── Check and consume ─────────────────────────────────────────────────────
  if (tokens < 1) {
    // Calculate how long until 1 token refills
    const retryAfterMs = Math.ceil((1 - tokens) / refillRate * 1000);

    logger.warn({
      api_key_id: req.apiKeyId,
      tokens:     tokens.toFixed(3),
      capacity,
    }, '[rateLimit] limit exceeded');

    res.setHeader('X-RateLimit-Limit',     capacity);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('Retry-After',           Math.ceil(retryAfterMs / 1000));

    throw Errors.tooManyReqs(
      `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)}s`
    );
  }

  // ── Consume 1 token and save ──────────────────────────────────────────────
  tokens -= 1;

  await redis.set(key, JSON.stringify({
    tokens,
    lastRefill: now,
  }), 'EX', 3600); // TTL 1 hour — stale keys clean themselves up

  // Set informational headers (clients can see their remaining quota)
  res.setHeader('X-RateLimit-Limit',     capacity);
  res.setHeader('X-RateLimit-Remaining', Math.floor(tokens));

  next();
}

module.exports = rateLimiter;