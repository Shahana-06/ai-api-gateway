/**
 * middleware/requestLogger.js
 *
 * Attaches a unique request ID to every request and logs start/finish.
 *
 * WHY REQUEST IDs:
 *   When multiple requests are in flight simultaneously, log lines from
 *   different requests are interleaved. A request ID lets you filter all
 *   logs for a single request — invaluable when debugging a specific failure.
 *   Convention: pass req_id back in the response header as X-Request-Id so
 *   clients can include it in bug reports.
 *
 * WHAT WE LOG:
 *   - On request start: method, path, IP
 *   - On response finish: status code, duration in ms
 *   We use the 'finish' event on the response object, which fires after the
 *   last byte is sent — giving us accurate latency including response write time.
 *
 * NOTE ON BODY LOGGING:
 *   We deliberately do NOT log request bodies. Bodies may contain API keys,
 *   passwords, or PII. We only log the path and method.
 */

const { randomUUID } = require('crypto');
const logger         = require('../utils/logger');

function requestLogger(req, res, next) {
  // Attach a unique ID to the request object so other middleware can reference it
  req.id        = randomUUID();
  req.startTime = Date.now();

  // Forward the ID to the client in the response header
  res.setHeader('X-Request-Id', req.id);

  // Log when the request arrives
  logger.info({
    req_id: req.id,
    method: req.method,
    path:   req.path,
    ip:     req.ip,
  }, `→ ${req.method} ${req.path}`);

  // 'finish' fires after the response is fully sent
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const level    = res.statusCode >= 500 ? 'error'
                   : res.statusCode >= 400 ? 'warn'
                   : 'info';

    logger[level]({
      req_id:     req.id,
      method:     req.method,
      path:       req.path,
      status:     res.statusCode,
      latency_ms: duration,
    }, `← ${res.statusCode} ${req.method} ${req.path} (${duration}ms)`);
  });

  next();
}

module.exports = requestLogger;
