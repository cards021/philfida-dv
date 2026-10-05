"use strict";
/**
 * Vercel serverless entry point. The Express app handles the API routes
 * (/api/*, /login, /signup, /logout, /export-dv-excel — see vercel.json
 * rewrites); static files are served by Vercel's CDN from client/dist.
 * The platform invokes the exported app per request — never call listen().
 */
const { createApp } = require("../server/src/app.js");

module.exports = createApp();
