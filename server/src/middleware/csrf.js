"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCsrfToken = ensureCsrfToken;
exports.requireCsrf = requireCsrf;
const node_crypto_1 = require("node:crypto");
/**
 * CSRF protection, mirroring the PHP bootstrap: one token per session,
 * reused across requests. State-changing endpoints must send it back as the
 * `X-CSRF-Token` header (the frontend does this centrally in postJSON()).
 * Read-only actions (list/get/stats/next_dv_no) and the Excel export don't
 * need it — the QR "quick register" link is opened directly by a phone
 * camera, which can't attach a custom header.
 */
function ensureCsrfToken(req, _res, next) {
    if (!req.session.csrf_token) {
        req.session.csrf_token = (0, node_crypto_1.randomBytes)(32).toString('hex');
    }
    next();
}
function requireCsrf(req, res, next) {
    const expected = req.session.csrf_token ?? '';
    const sent = req.get('X-CSRF-Token') ?? '';
    const a = Buffer.from(expected);
    const b = Buffer.from(sent);
    if (a.length !== b.length || !(0, node_crypto_1.timingSafeEqual)(a, b)) {
        res.status(403).json({ error: 'Invalid or missing security token. Please refresh the page and try again.' });
        return;
    }
    next();
}
//# sourceMappingURL=csrf.js.map