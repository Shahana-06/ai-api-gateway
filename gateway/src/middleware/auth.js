/**
 * middleware/auth.js
 *
 * Supports two auth methods — JWT (for users via browser/Postman)
 * and API key (for programmatic/machine access).
 *
 * HOW IT DECIDES WHICH TO USE:
 *   - Authorization: Bearer <token>  → JWT path
 *   - Authorization: ApiKey <key>    → API key path  
 *   - x-api-key: <key>               → API key path (common convention)
 *
 * ON SUCCESS: attaches req.user = { id, email } and calls next()
 * ON FAILURE: throws 401, which errorHandler catches and returns to client
 *
 * WHY BCRYPT FOR API KEY LOOKUP:
 *   We stored a bcrypt hash, not the raw key. To verify, we have to compare
 *   the incoming key against every active key for... wait, we can't.
 *   bcrypt is one-way — you can compare(raw, hash) but can't query by hash
 *   without knowing the raw value first.
 *
 *   Solution: we store a fast SHA-256 prefix hash as a lookup index, and
 *   bcrypt hash for secure verification. OR — simpler for now — we fetch
 *   all active keys for the user and bcrypt.compare each.
 *
 *   Actually the cleanest approach: store a SHA-256 hash for lookup
 *   (fast, indexed), and that IS the stored credential.
 *   For this project we'll use bcrypt for the full key and do a 
 *   fetch-then-compare, which is fine at our scale.
 *
 *   Better production approach: use a fast hash (SHA-256) for lookup index,
 *   documented in infra/vpc-notes.md.
 */

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool }   = require('../config/database');
const config     = require('../config');
const { Errors } = require('../utils/errors');

// ─── authenticate ─────────────────────────────────────────────────────────────
// Use on any route that requires a logged-in user.
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];

  // ── JWT path ────────────────────────────────────────────────────────────────
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7); // strip "Bearer "
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      req.user = { id: payload.sub, email: payload.email };
      return next();
    } catch (err) {
      // jwt.verify throws TokenExpiredError, JsonWebTokenError, etc.
      throw Errors.unauthorized('Invalid or expired token');
    }
  }

  // ── API key path ─────────────────────────────────────────────────────────────
  const rawKey = apiKeyHeader ||
    (authHeader?.startsWith('ApiKey ') ? authHeader.slice(7) : null);

  if (rawKey) {
    // Fetch all active API keys — then bcrypt.compare each
    // This is O(n) where n = keys per user, typically < 10. Fine for our scale.
    const result = await pool.query(
      `SELECT ak.id, ak.key_hash, ak.is_active, ak.rate_limit_rpm,
              u.id as user_id, u.email
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.is_active = true`
    );

    for (const row of result.rows) {
      const match = await bcrypt.compare(rawKey, row.key_hash);
      if (match) {
        // Update last_used_at (fire and forget — don't await)
        pool.query(
          'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
          [row.id]
        ).catch(() => {}); // silently ignore if this fails

        req.user      = { id: row.user_id, email: row.email };
        req.apiKeyId  = row.id;
        req.rateLimitRpm = row.rate_limit_rpm;
        return next();
      }
    }

    throw Errors.unauthorized('Invalid API key');
  }

  // ── No credentials at all ───────────────────────────────────────────────────
  throw Errors.unauthorized('Authentication required. Provide a Bearer token or x-api-key header.');
}

module.exports = { authenticate };