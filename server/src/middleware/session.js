"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionMiddleware = void 0;
const express_session_1 = __importDefault(require("express-session"));
const express_mysql_session_1 = __importDefault(require("express-mysql-session"));
const config_js_1 = require("../config.js");
const MySQLStore = (0, express_mysql_session_1.default)(express_session_1.default);
/**
 * Session middleware. Sessions live in MySQL (same database as the app, in
 * the `sessions` table created automatically), so logins survive restarts
 * like the old PHP file sessions did. The "remember me" checkbox extends the
 * cookie lifetime to 30 days at login time; otherwise the cookie is
 * session-scoped.
 */
exports.sessionMiddleware = (0, express_session_1.default)({
    secret: config_js_1.config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new MySQLStore({
        host: config_js_1.config.db.host,
        port: config_js_1.config.db.port,
        user: config_js_1.config.db.user,
        password: config_js_1.config.db.password,
        database: config_js_1.config.db.database,
        ssl: config_js_1.config.db.ssl,
        charset: 'utf8mb4',
        createDatabaseTable: true,
    }),
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config_js_1.config.cookieSecure,
        path: '/',
        // maxAge is left unset (browser-session cookie) unless login extends it.
    },
    name: 'philfida.sid',
});