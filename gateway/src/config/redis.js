/**
 * config/redis.js
 *
 * ioredis client — a singleton shared across the entire app.
 *
 * WHY IOREDIS OVER THE OFFICIAL `redis` PACKAGE:
 *   ioredis has built-in reconnection logic, Lua scripting support, and
 *   first-class cluster mode. The official `redis` v4 is good too, but
 *   ioredis is more common in Node gateway/proxy patterns and has better
 *   docs for the patterns we use (BRPOP, Lua, pipeline).
 *
 * WHY A SINGLETON:
 *   Each ioredis instance opens a TCP connection to Redis. Creating a new
 *   client per request would exhaust file descriptors fast. We create one
 *   client at startup and share it everywhere.
 *
 * RECONNECTION BEHAVIOUR:
 *   ioredis retries on disconnect automatically. We cap it at 10 attempts
 *   with exponential backoff. If Redis is down for > ~30 seconds, the client
 *   stops retrying and emits an 'error' event — the /health endpoint will
 *   catch this and return 503.
 */

const Redis  = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

// ─── Client creation ──────────────────────────────────────────────────────────
const redis = new Redis({
  host:     config.redis.host,
  port:     config.redis.port,
  password: config.redis.password, // undefined = no AUTH command sent
  maxRetriesPerRequest: 3,

  // Custom retry strategy — exponential backoff, give up after 10 attempts.
  retryStrategy(times) {
    if (times > 10) {
      logger.error('[redis] Max reconnection attempts reached — giving up');
      return null; // null = stop retrying
    }
    const delay = Math.min(times * 200, 3000); // 200ms, 400ms … capped at 3s
    logger.warn(`[redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
});

// ─── Event listeners ──────────────────────────────────────────────────────────
redis.on('connect',         () => logger.info('[redis] Connected'));
redis.on('ready',           () => logger.info('[redis] Ready'));
redis.on('error',    (err)  => logger.error({ err }, '[redis] Error'));
redis.on('close',           () => logger.warn('[redis] Connection closed'));
redis.on('reconnecting',    () => logger.warn('[redis] Reconnecting…'));

// ─── testConnection ───────────────────────────────────────────────────────────
/**
 * Sends a PING and checks for PONG. Used by /health and server.js startup.
 */
async function testConnection() {
  const result = await redis.ping();
  if (result !== 'PONG') throw new Error(`[redis] Unexpected PING response: ${result}`);
}

module.exports = { redis, testConnection };
