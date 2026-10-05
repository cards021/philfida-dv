"use strict";
/**
 * Express app factory. Imported by the local server entry (src/index.js,
 * which also listens) and by serverless wrappers, which must NOT listen.
 */
const express = require('express');
const securityHeaders = require('./middleware/securityHeaders.js');
const { sessionMiddleware } = require('./middleware/session.js');
const authRoutes = require('./routes/auth.js');
const voucherRoutes = require('./routes/vouchers.js');
const exportRoutes = require('./routes/export.js');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // honor x-forwarded-proto for secure cookies

  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(sessionMiddleware);

  app.use('/api/auth', authRoutes);
  app.use('/api/vouchers', voucherRoutes);
  app.use('/api/export', exportRoutes);

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Fallthrough: unknown API paths -> 404 JSON (never HTML).
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  return app;
}

module.exports = { createApp };
