"use strict";
/**
 * Vercel serverless entry point for the `api` service.
 * The platform invokes the exported Express app per request —
 * never call listen() here. (Local development uses src/index.js,
 * which verifies the DB and listens on PORT.)
 */
const { createApp } = require('../src/app.js');
const { assertProductionSecrets } = require('../src/config.js');

// Fail fast on cold start if SESSION_SECRET is missing in production,
// instead of silently signing session cookies with the dev fallback.
assertProductionSecrets();

module.exports = createApp();
