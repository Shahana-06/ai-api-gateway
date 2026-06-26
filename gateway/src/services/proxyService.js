/**
 * services/proxyService.js
 *
 * Forwards the original request to the resolved upstream service.
 * Passes through the method, headers, and body unchanged.
 * Adds X-Intent and X-Request-Id headers so upstreams know what's happening.
 */

const logger     = require('../utils/logger');
const { Errors } = require('../utils/errors');

async function proxyToUpstream(req, upstreamUrl, intent) {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(upstreamUrl, {
      method:  req.method,
      headers: {
        'Content-Type':  'application/json',
        'X-Request-Id':  req.id,
        'X-Intent':      intent,
        'X-Forwarded-By': 'ai-gateway',
      },
      // Don't send body for GET/HEAD requests
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      signal: controller.signal,
    });

    const data = await response.json();

    logger.info({
      upstream:    upstreamUrl,
      intent,
      status:      response.status,
    }, '[proxy] upstream responded');

    return { status: response.status, data };

  } catch (err) {
    if (err.name === 'AbortError') {
      throw Errors.serviceUnavail(`Upstream timed out: ${upstreamUrl}`);
    }
    throw Errors.serviceUnavail(`Upstream unreachable: ${upstreamUrl}`);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { proxyToUpstream };