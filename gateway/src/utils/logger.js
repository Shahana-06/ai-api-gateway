/**
 * utils/logger.js
 *
 * Structured JSON logger built on pino.
 *
 * WHY STRUCTURED LOGGING (JSON) OVER console.log:
 *   console.log produces unstructured text. When you're debugging a production
 *   issue at 2am, you want to filter logs by tenant_id or trace_id — you
 *   can't do that with plain text. JSON logs can be ingested by CloudWatch
 *   Logs Insights, Datadog, or any log aggregator and queried like a database.
 *
 * WHY PINO:
 *   pino is the fastest Node.js logger — it writes to stdout asynchronously
 *   and lets the OS buffer the I/O. In a gateway that logs every request,
 *   the logger itself must not become a bottleneck.
 *
 * PRETTY PRINTING:
 *   In development (NODE_ENV=development), pino-pretty formats logs as
 *   human-readable coloured output. In production, raw JSON is written to
 *   stdout, which CloudWatch captures.
 *
 * USAGE:
 *   const logger = require('./utils/logger');
 *   logger.info('Server started');
 *   logger.error({ err, tenant_id }, 'Database write failed');
 *   logger.warn({ latency_ms: 4200 }, 'Slow request detected');
 */

const pino   = require('pino');
const config = require('../config');

const logger = pino({
  level: config.isDev ? 'debug' : 'info',

  // In development, stream through pino-pretty for readable output.
  // In production, write raw JSON directly to stdout.
  transport: config.isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,

  // These fields appear in every log line — useful for filtering in CloudWatch.
  base: {
    service: 'ai-gateway',
    env:     config.env,
  },
});

module.exports = logger;
