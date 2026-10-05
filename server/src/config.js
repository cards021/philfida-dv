"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.assertProductionSecrets = assertProductionSecrets;
require("dotenv/config");
/**
 * Runtime configuration. Environment variable names are identical to the
 * original PHP backend (DB_HOST, DB_NAME, DB_USER, DB_PASS) so existing
 * deployments keep working unchanged.
 */
function required(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing required environment variable ${name}`);
    return v;
}
exports.config = {
    db: {
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? 3306),
        database: process.env.DB_NAME ?? 'voucher_tracking',
        user: process.env.DB_USER ?? 'root',
        password: process.env.DB_PASS ?? '',
        // Hosted MySQL providers (PlanetScale, Aiven, ...) require TLS.
        // Set DB_SSL=true to enable it.
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    },
    sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-secret-change-me',
    port: Number(process.env.PORT ?? 3000),
    // 'auto' sets the Secure flag only on HTTPS requests (via trust proxy),
    // so cookies work on local HTTP and on Vercel's HTTPS alike. Set
    // COOKIE_SECURE=true to force it on.
    cookieSecure: process.env.COOKIE_SECURE === 'true' ? true : 'auto',
};
function assertProductionSecrets() {
    if (process.env.NODE_ENV === 'production') {
        required('SESSION_SECRET');
    }
}