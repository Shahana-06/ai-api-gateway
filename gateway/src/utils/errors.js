/**
 * utils/errors.js
 *
 * Custom error classes and the standard API error response shape.
 *
 * WHY CUSTOM ERROR CLASSES:
 *   JavaScript's built-in Error has no concept of HTTP status codes.
 *   By extending it, we can throw rich errors anywhere in the middleware
 *   chain and have the global error handler translate them to the right
 *   HTTP response — without writing try/catch blocks everywhere.
 *
 * HOW TO USE:
 *   throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
 *   → errorHandler middleware catches it
 *   → returns { success: false, error: { code, message } } with status 404
 *
 * ERROR RESPONSE SHAPE (all errors look the same to clients):
 *   {
 *     "success": false,
 *     "error": {
 *       "code":    "TENANT_NOT_FOUND",   // machine-readable, for client logic
 *       "message": "Tenant not found"    // human-readable
 *     }
 *   }
 */

// ─── AppError ─────────────────────────────────────────────────────────────────
class AppError extends Error {
  /**
   * @param {string} message   - Human-readable description
   * @param {number} status    - HTTP status code (default 500)
   * @param {string} code      - Machine-readable code (default 'INTERNAL_ERROR')
   */
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name       = 'AppError';
    this.status     = status;
    this.code       = code;
    this.isAppError = true; // flag so errorHandler can identify our errors
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Convenience constructors ─────────────────────────────────────────────────
// These read more clearly at call sites than raw `new AppError(...)`.

const Errors = {
  badRequest:    (msg, code = 'BAD_REQUEST')          => new AppError(msg, 400, code),
  unauthorized:  (msg = 'Unauthorized')               => new AppError(msg, 401, 'UNAUTHORIZED'),
  forbidden:     (msg = 'Forbidden')                  => new AppError(msg, 403, 'FORBIDDEN'),
  notFound:      (msg = 'Not found')                  => new AppError(msg, 404, 'NOT_FOUND'),
  tooManyReqs:   (msg = 'Rate limit exceeded')        => new AppError(msg, 429, 'RATE_LIMIT_EXCEEDED'),
  internal:      (msg = 'Internal server error')      => new AppError(msg, 500, 'INTERNAL_ERROR'),
  serviceUnavail:(msg = 'Service unavailable')        => new AppError(msg, 503, 'SERVICE_UNAVAILABLE'),
};

module.exports = { AppError, Errors };
