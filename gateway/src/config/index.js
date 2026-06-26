/**
 * config/index.js
 *
 * Central configuration loader.
 *
 * WHY THIS FILE EXISTS:
 *   Scattered process.env calls throughout the codebase are a maintenance
 *   nightmare. If an env var is renamed, you'd have to grep every file.
 *   Here, every env var is read ONCE, validated, and exported as a typed
 *   config object. The rest of the app imports from here, never from
 *   process.env directly.
 *
 * HOW IT WORKS:
 *   dotenv.config() reads your .env file and populates process.env.
 *   We then pull each variable, apply defaults where safe, and throw
 *   immediately on startup if a required variable is missing.
 *   "Fail fast" — better to crash at boot than fail silently mid-request.
 */

require('dotenv').config();

// ─── Validation helper ────────────────────────────────────────────────────────
// Throws at startup if a required env var is absent or empty.
function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[config] Missing required environment variable: ${name}\n` +
      `  → Copy .env.example to .env and fill in the value.`
    );
  }
  return value.trim();
}

// Like required(), but returns a fallback if the variable is not set.
function optional(name, defaultValue) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

// ─── Config object ────────────────────────────────────────────────────────────
const config = {
  // Server
  env:  optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),

  // PostgreSQL — all required; the app cannot start without a database.
  postgres: {
    host:     required('POSTGRES_HOST'),
    port:     parseInt(optional('POSTGRES_PORT', '5432'), 10),
    database: required('POSTGRES_DB'),
    user:     required('POSTGRES_USER'),
    password: required('POSTGRES_PASSWORD'),
    poolMax:  parseInt(optional('POSTGRES_POOL_MAX', '10'), 10),
  },

  // Redis
  redis: {
    host:     optional('REDIS_HOST', 'localhost'),
    port:     parseInt(optional('REDIS_PORT', '6379'), 10),
    password: optional('REDIS_PASSWORD', undefined), // undefined = no AUTH
  },

  // JWT (not used yet — Phase 2. Defined here so server.js validates it early.)
  jwt: {
    secret:    required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },

  // FastAPI AI service
  aiService: {
    url:       optional('AI_SERVICE_URL', 'http://localhost:8000'),
    timeoutMs: parseInt(optional('AI_SERVICE_TIMEOUT_MS', '10000'), 10),
  },

  // Rate limiting defaults
  rateLimitRpm: parseInt(optional('DEFAULT_RATE_LIMIT_RPM', '100'), 10),
};

// Convenience flags used in logging and error handling
config.isDev        = config.env === 'development';
config.isProduction = config.env === 'production';

module.exports = config;
