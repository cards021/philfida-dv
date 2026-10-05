"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const csrf_js_1 = require("../middleware/csrf.js");
const logos_js_1 = require("../lib/logos.js");
exports.bootstrapRouter = (0, express_1.Router)();
/**
 * GET /api/bootstrap — replaces the `window.APP_CONFIG` object the old PHP
 * pages injected into the HTML. The SPA fetches this once on startup for
 * its CSRF token, role, user info, and the letterhead logos.
 */
exports.bootstrapRouter.get('/api/bootstrap', auth_js_1.requireAuth, csrf_js_1.ensureCsrfToken, (req, res) => {
    const body = {
        csrfToken: req.session.csrf_token ?? '',
        isAdmin: (req.session.role ?? 'user') === 'admin',
        user: req.session.authenticated
            ? { fullName: req.session.full_name ?? '', role: req.session.role ?? 'user' }
            : null,
        logos: {
            philfida: logos_js_1.philfidaLogo,
            bagong: logos_js_1.bagongLogo,
            daPhilfida: logos_js_1.daPhilfidaLogo,
            socotec: logos_js_1.socotecLogo,
        },
    };
    res.json(body);
});
//# sourceMappingURL=bootstrap.js.map