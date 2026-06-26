/**
 * scripts/migrate.js
 *
 * Database migration script — run once before first startup.
 *
 * USAGE:
 *   node scripts/migrate.js
 *   npm run migrate
 *
 * WHY NOT USE AN ORM MIGRATION TOOL:
 *   Tools like Sequelize migrations or Flyway are great for large teams.
 *   For this project, a single SQL file run directly via node gives you full
 *   visibility and control. You can see exactly what SQL runs, and you can
 *   adapt it easily as the schema evolves.
 *
 * HOW TO ADD A NEW MIGRATION:
 *   Add a new `CREATE TABLE IF NOT EXISTS` block below. The IF NOT EXISTS
 *   guard makes this script idempotent — safe to run multiple times.
 *
 * WHAT GETS CREATED:
 *   Phase 1: users, api_keys, routing_rules, request_logs
 *   Future phases add columns or tables to this file.
 */

require('dotenv').config();
const { Pool } = require('pg');
const config   = require('../src/config');

const pool = new Pool({
  host:     config.postgres.host,
  port:     config.postgres.port,
  database: config.postgres.database,
  user:     config.postgres.user,
  password: config.postgres.password,
});

const MIGRATION_SQL = `
-- ─── Users ───────────────────────────────────────────────────────────────────
-- Represents a registered account. Each user can have multiple API keys.
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── API Keys ─────────────────────────────────────────────────────────────────
-- Each key is tied to a user and carries its own rate limit config.
-- We store a bcrypt HASH of the key — never the raw key.
-- The raw key is shown once at creation time and never again.
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash        TEXT        NOT NULL UNIQUE,
  name            TEXT,
  rate_limit_rpm  INTEGER     NOT NULL DEFAULT 100,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash    ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);

-- ─── Routing Rules ────────────────────────────────────────────────────────────
-- Maps an intent (returned by FastAPI) to an upstream service URL.
-- Loaded into Redis cache at startup; updated via admin API (Phase later).
CREATE TABLE IF NOT EXISTS routing_rules (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  intent       TEXT    NOT NULL UNIQUE,
  upstream_url TEXT    NOT NULL,
  timeout_ms   INTEGER NOT NULL DEFAULT 5000,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed initial routing rules
INSERT INTO routing_rules (intent, upstream_url) VALUES
  ('payments',      'http://localhost:4001'),
  ('analytics',     'http://localhost:4002'),
  ('auth',          'http://localhost:4003'),
  ('notifications', 'http://localhost:4004')
ON CONFLICT (intent) DO NOTHING;

-- ─── Request Logs ─────────────────────────────────────────────────────────────
-- One row per request. Powers the observability dashboard.
-- BIGSERIAL primary key (auto-incrementing integer) is cheaper for a
-- high-write table than UUID because it doesn't fragment the index.
CREATE TABLE IF NOT EXISTS request_logs (
  id          BIGSERIAL   PRIMARY KEY,
  req_id      TEXT,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  intent      TEXT,
  route       TEXT,
  status_code INTEGER,
  latency_ms  INTEGER,
  token_count INTEGER     DEFAULT 0,
  model       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Index for dashboard queries: filter by user, order by time
CREATE INDEX IF NOT EXISTS idx_request_logs_user    ON request_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_intent  ON request_logs (intent);
`;

async function migrate() {
  console.log('[migrate] Connecting to Postgres…');
  const client = await pool.connect();
  try {
    console.log('[migrate] Running migration…');
    await client.query(MIGRATION_SQL);
    console.log('[migrate] ✓ Done — all tables created (or already exist)');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err.message);
  process.exit(1);
});
