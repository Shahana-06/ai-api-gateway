/**
 * middleware/errorHandler.js
 *
 * Global error handler — the last middleware in the Express chain.
 *
 * HOW EXPRESS ERROR HANDLING WORKS:
 *   Any middleware that calls next(err), or any async function that throws
 *   (when using express-async-errors), is routed here. This is the single
 *   place that decides what the client sees when something goes wrong.
 *
 * WHY CENTRALISE ERROR HANDLING:
 *   Without this, you'd need try/catch in every route and would likely
 *   return inconsistent error shapes. Centralising means:
 *   - Every error response looks the same (clients can parse them reliably)
 *   - Stack traces are logged in one place
 *   - You never accidentally leak a stack trace to the client in production
 *
 * SIGNATURE:
 *   Express identifies error handlers by the (err, req, res, next) signature
 *   — four parameters, not three. Do NOT remove the `next` parameter even
 *   though it's unused; Express needs it to detect this as an error handler.
 */

const logger          = require('../utils/logger');
const { AppError }    = require('../utils/errors');
const config          = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // ── 1. Determine status and code ──────────────────────────────────────────
  const status  = err.isAppError ? err.status  : 500;
  const code    = err.isAppError ? err.code    : 'INTERNAL_ERROR';
  const message = err.isAppError ? err.message : 'An unexpected error occurred';

  // ── 2. Log the error ──────────────────────────────────────────────────────
  // Always log 5xx errors with full stack. Log 4xx at warn level (client errors,
  // not our fault, but worth knowing about).
  if (status >= 500) {
    logger.error({
      err,
      req_id:    req.id,       // set by requestLogger (Phase later)
      method:    req.method,
      path:      req.path,
      tenant_id: req.tenantId, // set by auth middleware (Phase 2)
    }, `[error] ${code}: ${err.message}`);
  } else {
    logger.warn({
      code,
      status,
      method:    req.method,
      path:      req.path,
    }, `[warn] ${code}: ${message}`);
  }

  // ── 3. Build response ────────────────────────────────────────────────────
  const body = {
    success: false,
    error: { code, message },
  };

  // In development, attach the stack trace so you can debug in the response.
  // NEVER send stack traces in production — they leak internals.
  if (config.isDev && !err.isAppError) {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = errorHandler;
