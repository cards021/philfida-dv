"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const config_js_1 = require("./config.js");
/**
 * Shared MySQL connection pool (mysql2). `dateStrings: true` keeps DATE and
 * DATETIME columns as 'YYYY-MM-DD [HH:MM:SS]' strings, exactly like the old
 * PHP/PDO backend returned them, so the frontend contract is unchanged.
 */
exports.pool = promise_1.default.createPool({
    host: config_js_1.config.db.host,
    port: config_js_1.config.db.port,
    user: config_js_1.config.db.user,
    password: config_js_1.config.db.password,
    database: config_js_1.config.db.database,
    ssl: config_js_1.config.db.ssl,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    namedPlaceholders: true,
});