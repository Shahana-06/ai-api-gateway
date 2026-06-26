/**
 * modules/auth/authService.js
 *
 * Pure business logic for auth — no Express, no req/res.
 * Routes call these functions. Keeping logic here (not in routes)
 * means you can unit test it without spinning up an HTTP server.
 */

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool }  = require('../../config/database');
const config    = require('../../config');
const { Errors } = require('../../utils/errors');

// ─── Register ─────────────────────────────────────────────────────────────────
async function register(email, password) {
  // 1. Check if email already exists
  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );
  if (existing.rows.length > 0) {
    throw Errors.badRequest('Email already registered', 'EMAIL_TAKEN');
  }

  // 2. Hash password — bcrypt with cost factor 10
  //    Cost 10 = ~100ms on a modern CPU. Slow enough to defeat brute force,
  //    fast enough to not annoy users. Never store plaintext passwords.
  const passwordHash = await bcrypt.hash(password, 10);

  // 3. Insert user
  const result = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email, passwordHash]
  );

  return result.rows[0];
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(email, password) {
  // 1. Find user
  const result = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];

  // Return the same error for "user not found" and "wrong password"
  // — never tell attackers which one it was
  if (!user) throw Errors.unauthorized('Invalid email or password');

  // 2. Compare password against hash
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw Errors.unauthorized('Invalid email or password');

  // 3. Sign JWT
  //    Payload: just the user id. Keep JWTs small — don't put sensitive
  //    data in them. The payload is base64-encoded, not encrypted — anyone
  //    can decode it. The signature is what makes it tamper-proof.
  const token = jwt.sign(
    { sub: user.id, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return { token, user: { id: user.id, email: user.email } };
}

// ─── Create API Key ───────────────────────────────────────────────────────────
async function createApiKey(userId, name) {
  // 1. Generate a random key: "gw_" prefix + 32 random hex bytes
  //    The prefix makes it easy to identify in logs/config files
  const rawKey = 'gw_' + require('crypto').randomBytes(32).toString('hex');

  // 2. Hash it for storage — same principle as passwords.
  //    If your DB is breached, attackers can't use the hashes directly.
  const keyHash = await bcrypt.hash(rawKey, 10);

  // 3. Store the hash, return the raw key ONCE.
  //    After this function returns, the raw key is gone — not stored anywhere.
  const result = await pool.query(
    `INSERT INTO api_keys (user_id, key_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, name, rate_limit_rpm, created_at`,
    [userId, keyHash, name || 'Default key']
  );

  return {
    ...result.rows[0],
    key: rawKey,  // shown ONCE — user must copy it now
    message: 'Copy this key — it will not be shown again',
  };
}

// ─── List API Keys ────────────────────────────────────────────────────────────
async function listApiKeys(userId) {
  const result = await pool.query(
    `SELECT id, name, rate_limit_rpm, is_active, last_used_at, created_at
     FROM api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  // Note: we never return key_hash — it never leaves the DB
  return result.rows;
}

module.exports = { register, login, createApiKey, listApiKeys };