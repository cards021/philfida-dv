"use strict";
/**
 * Seed script: creates tables from schema.sql (idempotent) and ensures an
 * admin user exists. Run with:  node seed.js
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from the environment
 * (see .env.example). Never commit real credentials.
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'System Administrator').trim();
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env before seeding.');
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'voucher_tracking',
    charset: 'utf8mb4',
    multipleStatements: true,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log(`Schema ready (${statements.length} statements).`);

  const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    console.log(`Admin already exists: ${email} (nothing changed)`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [email, hash, name, 'admin'],
    );
    console.log(`Admin created: ${email} (id ${result.insertId})`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
