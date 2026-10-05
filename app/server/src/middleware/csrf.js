"use strict";
/**
 * CSRF protection: one token per session. State-changing endpoints require
 * it back as the `X-CSRF-Token` header. The SPA fetches a token from the
 * public GET /api/auth/csrf before its first POST.
 */
const { randomBytes, timingSafeEqual } = require('node:crypto');

function newToken() {
  return randomBytes(32).toString('hex');
}

function requireCsrf(req, res, next) {
  const expected = req.session.csrfToken || '';
  const sent = req.get('X-CSRF-Token') || '';
  const a = Buffer.from(expected);
  const b = Buffer.from(sent);
  if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
  }
  next();
}

module.exports = { newToken, requireCsrf };
