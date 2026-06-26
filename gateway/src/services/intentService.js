/**
 * services/intentService.js
 *
 * Calls the FastAPI AI service to classify a request body.
 * Returns { intent, confidence, route, tokens_used, injection_detected }
 *
 * This is the SYNC path (Phase 4). The async Redis queue path comes in Phase 8.
 * We call FastAPI directly with a timeout — if it takes more than 10s, we fail.
 */

const config     = require('../config');
const logger     = require('../utils/logger');
const { Errors } = require('../utils/errors');

async function classifyIntent(body) {
  const url = `${config.aiService.url}/classify`;

  // Use AbortController to enforce a timeout on the fetch call
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), config.aiService.timeoutMs);

  try {
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ body: typeof body === 'string' ? body : JSON.stringify(body) }),
      signal:  controller.signal,
    });

    if (!response.ok) {
      throw Errors.internal(`AI service returned ${response.status}`);
    }

    const result = await response.json();

    logger.info({
      intent:     result.intent,
      confidence: result.confidence,
      tokens:     result.tokens_used,
    }, '[intent] classified');

    return result;

  } catch (err) {
    if (err.name === 'AbortError') {
      throw Errors.serviceUnavail('AI service timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { classifyIntent };