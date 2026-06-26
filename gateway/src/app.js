/**
 * app.js
 *
 * Express application factory — sets up middleware and routes.
 *
 * WHY SEPARATE app.js FROM server.js:
 *   server.js is responsible for "starting the server" — binding a port,
 *   connecting to databases, handling process signals.
 *   app.js is responsible for "building the Express app" — middleware order,
 *   routes, error handlers.
 *
 *   This separation matters for testing: your test files can import app.js
 *   and use supertest without actually starting a server on a real port.
 *   If you merged both into one file, tests would bind real ports and
 *   potentially conflict with each other.
 *
 * MIDDLEWARE ORDER MATTERS:
 *   Express runs middleware in the order you register it. The order here is:
 *
 *   1. Security headers (helmet)  ← should be first, before any response
 *   2. Request logger             ← attach req.id early so all logs have it
 *   3. Body parser                ← parse JSON before any route reads req.body
 *   4. Routes                     ← actual business logic
 *   5. 404 handler                ← catches unmatched routes
 *   6. Error handler              ← catches errors from all above middleware
 *
 *   Putting the error handler before routes would mean route errors are never
 *   caught. Putting the body parser after routes means req.body is always {}.
 */

require('express-async-errors'); // patches Express to forward async throws to next(err)

const express        = require('express');
const requestLogger  = require('./middleware/requestLogger');
const notFound       = require('./middleware/notFound');
const errorHandler   = require('./middleware/errorHandler');
const healthRouter   = require('./routes/health');

const app = express();

// ─── 1. Security headers ───────────────────────────────────────────────────────
// Sets sensible HTTP headers: X-Content-Type-Options, X-Frame-Options, etc.
// Tiny line, big security value. Always include this.
// We require it conditionally so the scaffold works without helmet installed yet;
// add helmet to dependencies and uncomment the line below once you run npm install.
// const helmet = require('helmet');
// app.use(helmet());

// ─── 2. Trust proxy ────────────────────────────────────────────────────────────
// Tells Express to trust the X-Forwarded-For header from the ALB.
// Without this, req.ip would always show the ALB's private IP, not the client's.
// '1' means trust one level of proxy (the ALB). Don't set this to 'true' —
// that would trust any X-Forwarded-For header, which is a security hole.
app.set('trust proxy', 1);

// ─── 3. Request logger ─────────────────────────────────────────────────────────
// Must come before routes so every request gets a req.id and logged.
app.use(requestLogger);

// ─── 4. Body parsers ───────────────────────────────────────────────────────────
// Parse incoming JSON bodies and make them available as req.body.
// limit: '1mb' — rejects payloads over 1MB before they hit your routes.
// This prevents trivial DoS attacks that send huge JSON blobs.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── 5. Routes ────────────────────────────────────────────────────────────────
app.use(healthRouter);

// Auth routes — Phase 2
app.use('/api/auth', require('./modules/auth/authRoutes'));
app.use(require('./routes/gateway'));   // add this line
// app.use('/api',      require('./modules/gateway/routes'));      // Phase 4
// app.use('/dashboard',require('./modules/dashboard/routes'));    // Phase 9

// ─── 6. 404 + Error handler ───────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
