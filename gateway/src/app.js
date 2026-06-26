require('express-async-errors');

const express        = require('express');
const requestLogger  = require('./middleware/requestLogger');
const notFound       = require('./middleware/notFound');
const errorHandler   = require('./middleware/errorHandler');
const healthRouter   = require('./routes/health');
const rateLimiter    = require('./middleware/rateLimiter');

const app = express();

// 1. Trust proxy
app.set('trust proxy', 1);

// 2. Request logger
app.use(requestLogger);

// 3. Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// 4. Health check (no rate limiting on health)
app.use(healthRouter);

// 6. Routes
app.use('/api/auth', require('./modules/auth/authRoutes'));
app.use(require('./routes/gateway'));

// 7. 404 + Error handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;