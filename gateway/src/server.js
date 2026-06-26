/**
 * server.js
 *
 * Entry point. Connects to dependencies, starts listening, handles shutdown.
 *
 * STARTUP SEQUENCE:
 *   1. Validate environment variables (config/index.js throws if any are missing)
 *   2. Test Postgres connection
 *   3. Test Redis connection
 *   4. Start listening on PORT
 *
 *   If steps 1–3 fail, the process exits with code 1. This is intentional —
 *   a gateway that can't reach its database is useless and should not accept
 *   traffic. The ALB health check will route traffic elsewhere.
 *
 * GRACEFUL SHUTDOWN (SIGTERM / SIGINT):
 *   When AWS stops an EC2 instance or you press Ctrl+C, Node receives SIGTERM
 *   or SIGINT. Without a handler, the process dies immediately — any requests
 *   in flight are dropped, open DB connections are forcefully closed.
 *
 *   Our shutdown handler:
 *   1. Stops accepting new connections (server.close)
 *   2. Waits for in-flight requests to finish (up to SHUTDOWN_TIMEOUT_MS)
 *   3. Closes the Postgres pool and Redis client cleanly
 *   4. Exits with code 0 (clean) or 1 (error)
 *
 *   This matters for the ALB: before terminating an instance, AWS sends
 *   a deregistration signal. The ALB stops routing new requests to the
 *   instance, then waits (deregistration delay, default 300s). Our shutdown
 *   handler lets in-flight requests drain during this window.
 */

const app                        = require('./app');
const config                     = require('./config');
const logger                     = require('./utils/logger');
const { pool, testConnection: pgTest }    = require('./config/database');
const { redis, testConnection: redisTest } = require('./config/redis');

const SHUTDOWN_TIMEOUT_MS = 10_000; // 10 seconds to drain in-flight requests

async function start() {
  // ── Step 1: Config is validated at import time by config/index.js ──────────
  logger.info(`[startup] Environment: ${config.env}`);

  // ── Step 2: Test Postgres ──────────────────────────────────────────────────
  logger.info('[startup] Testing Postgres connection…');
  try {
    await pgTest();
    logger.info('[startup] Postgres ✓');
  } catch (err) {
    logger.fatal({ err }, '[startup] Cannot connect to Postgres — aborting');
    process.exit(1);
  }

  // ── Step 3: Test Redis ─────────────────────────────────────────────────────
  logger.info('[startup] Testing Redis connection…');
  try {
    await redisTest();
    logger.info('[startup] Redis ✓');
  } catch (err) {
    logger.fatal({ err }, '[startup] Cannot connect to Redis — aborting');
    process.exit(1);
  }

  // ── Step 4: Start HTTP server ──────────────────────────────────────────────
  const server = app.listen(config.port, () => {
    logger.info(`[startup] Gateway listening on port ${config.port} ✓`);
    logger.info(`[startup] Health check: http://localhost:${config.port}/health`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal) {
    logger.info(`[shutdown] Received ${signal} — starting graceful shutdown`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('[shutdown] HTTP server closed');

      // Close Postgres pool
      try {
        await pool.end();
        logger.info('[shutdown] Postgres pool closed');
      } catch (err) {
        logger.error({ err }, '[shutdown] Error closing Postgres pool');
      }

      // Quit Redis client
      try {
        await redis.quit();
        logger.info('[shutdown] Redis client closed');
      } catch (err) {
        logger.error({ err }, '[shutdown] Error closing Redis client');
      }

      logger.info('[shutdown] Goodbye');
      process.exit(0);
    });

    // Force-kill if drain takes too long
    setTimeout(() => {
      logger.error('[shutdown] Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM')); // AWS stop instance
  process.on('SIGINT',  () => shutdown('SIGINT'));  // Ctrl+C in dev
}

// Catch any synchronous startup errors
start().catch((err) => {
  logger.fatal({ err }, '[startup] Unhandled startup error');
  process.exit(1);
});
