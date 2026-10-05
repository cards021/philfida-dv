"use strict";
/**
 * Sessions live in MySQL (same database, `sessions` table auto-created), so
 * logins survive restarts and work across serverless instances. The
 * "remember me" checkbox extends the cookie to 30 days at login time;
 * otherwise the cookie is session-scoped.
 */
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { config } = require('../config.js');

const sessionMiddleware = session({
  name: 'philfida.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new MySQLStore({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: 'utf8mb4',
    ssl: config.db.ssl,
    createDatabaseTable: true,
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  },
});

module.exports = { sessionMiddleware };
