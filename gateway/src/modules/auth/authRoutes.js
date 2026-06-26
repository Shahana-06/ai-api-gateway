/**
 * modules/auth/authRoutes.js
 *
 * Thin route handlers — validate input, call authService, return response.
 * No business logic here. Routes are just the HTTP layer.
 */

const express     = require('express');
const router      = express.Router();
const authService = require('./authService');
const { authenticate } = require('../../middleware/auth');
const { Errors }  = require('../../utils/errors');

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw Errors.badRequest('email and password are required');
  }
  if (password.length < 8) {
    throw Errors.badRequest('Password must be at least 8 characters');
  }
  if (!email.includes('@')) {
    throw Errors.badRequest('Invalid email address');
  }

  const user = await authService.register(email, password);

  res.status(201).json({
    success: true,
    data: user,
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw Errors.badRequest('email and password are required');
  }

  const result = await authService.login(email, password);

  res.json({
    success: true,
    data: result,
  });
});

// ─── POST /api/auth/keys ──────────────────────────────────────────────────────
// Protected — must be logged in to create an API key
router.post('/keys', authenticate, async (req, res) => {
  const { name } = req.body;
  const apiKey = await authService.createApiKey(req.user.id, name);

  res.status(201).json({
    success: true,
    data: apiKey,
  });
});

// ─── GET /api/auth/keys ───────────────────────────────────────────────────────
router.get('/keys', authenticate, async (req, res) => {
  const keys = await authService.listApiKeys(req.user.id);

  res.json({
    success: true,
    data: keys,
  });
});

module.exports = router;