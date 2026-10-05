"use strict";
/**
 * Shared MySQL connection pool (mysql2). `dateStrings: true` keeps DATE and
 * DATETIME columns as 'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM:SS' strings, matching
 * the API contract. DECIMAL columns arrive as strings and are coerced to
 * numbers in the mapper.
 */
const mysql = require('mysql2/promise');
const { config } = require('./config.js');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  namedPlaceholders: true,
  ssl: config.db.ssl,
});

module.exports = { pool };
