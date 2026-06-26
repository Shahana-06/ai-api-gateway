/**
 * middleware/notFound.js
 *
 * 404 handler — sits after all routes, before the error handler.
 *
 * WHY THIS IS A SEPARATE MIDDLEWARE AND NOT PART OF errorHandler:
 *   When Express reaches the end of the middleware chain without any route
 *   matching, it does nothing (or returns an empty 404 with no body, depending
 *   on the version). This middleware explicitly catches that case and forwards
 *   it to the error handler as a clean AppError with a 404 status.
 *
 * PLACEMENT IN app.js:
 *   app.use(routerA)
 *   app.use(routerB)
 *   app.use(notFound)     ← here, after all routes
 *   app.use(errorHandler) ← error handler last
 */

const { Errors } = require('../utils/errors');

function notFound(req, res, next) {
  next(Errors.notFound(`Route not found: ${req.method} ${req.path}`));
}

module.exports = notFound;
