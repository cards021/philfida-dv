"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.redirectGuests = redirectGuests;
/** JSON 401 for API calls when the session isn't authenticated. */
function requireAuth(req, res, next) {
    if (!req.session.authenticated) {
        res.status(401).json({ error: 'Session expired. Please sign in again.' });
        return;
    }
    next();
}
/** Delete is restricted to admins server-side (hiding the button is UX only). */
function requireAdmin(req, res, next) {
    if ((req.session.role ?? 'user') !== 'admin') {
        res.status(403).json({ error: 'Only Admin accounts can delete vouchers.' });
        return;
    }
    next();
}
/** HTML pages redirect to the login page instead of returning JSON. */
function redirectGuests(req, res, next) {
    if (!req.session.authenticated) {
        res.redirect('/login.html');
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map