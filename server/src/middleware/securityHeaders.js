"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityHeaders = securityHeaders;
/**
 * Security headers, mirroring what the PHP entry points sent on every
 * response: nosniff, DENY framing, same-origin referrer, and HSTS when the
 * request came over HTTPS.
 */
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    const proto = req.get('x-forwarded-proto') ?? req.protocol;
    if (proto === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
}
//# sourceMappingURL=securityHeaders.js.map