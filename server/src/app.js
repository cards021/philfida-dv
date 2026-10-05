"use strict";
/**
 * Express app factory. Imported by both the local server entry
 * (`index.js`, which also listens) and the Vercel serverless entry
 * (`api/server.js` at the repo root, which must NOT listen).
 */
const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const { securityHeaders } = require("./middleware/securityHeaders.js");
const { sessionMiddleware } = require("./middleware/session.js");
const { ensureCsrfToken } = require("./middleware/csrf.js");
const { redirectGuests } = require("./middleware/auth.js");
const { apiRouter } = require("./routes/api.js");
const { authRouter } = require("./routes/auth.js");
const { exportRouter } = require("./routes/export.js");
const { bootstrapRouter } = require("./routes/bootstrap.js");

function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1); // honor x-forwarded-proto for secure cookies/HSTS
    app.use(securityHeaders);
    app.use(express.json({ limit: "1mb" }));
    app.use(express.urlencoded({ extended: false, limit: "1mb" }));
    app.use(sessionMiddleware);
    app.use(ensureCsrfToken);
    app.use(apiRouter); // GET|POST /api?action=...
    app.use(authRouter); // POST /login, POST /signup, GET /logout
    app.use(exportRouter); // POST /export-dv-excel
    app.use(bootstrapRouter); // GET /api/bootstrap
    // Serve the built frontend when present and not on Vercel (Vercel's CDN
    // serves client/dist statically; the function only handles API routes).
    const onVercel = process.env.VERCEL === "1";
    const clientDist = path.resolve(__dirname, "..", "..", "client", "dist");
    if (!onVercel && fs.existsSync(clientDist)) {
        app.get("/", redirectGuests, (_req, res) => {
            res.sendFile(path.join(clientDist, "index.html"));
        });
        app.use(express.static(clientDist, { index: false }));
        app.get("*", redirectGuests, (_req, res) => {
            res.sendFile(path.join(clientDist, "index.html"));
        });
    }
    return app;
}

module.exports = { createApp };
