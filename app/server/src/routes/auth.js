"use strict";
/**
 * Auth routes. The SPA first calls the public GET /api/auth/csrf to obtain
 * a CSRF token (and establish a session); every POST below requires it back
 * as the X-CSRF-Token header.
 */
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const { pool } = require('../db.js');
const { newToken, requireCsrf } = require('../middleware/csrf.js');
const { requireAuth } = require('../middleware/auth.js');

const router = Router();

// Static dummy bcrypt hash: always run the (slow) compare, even when the
// account doesn't exist, so timing can't reveal "wrong password" vs
// "no such user".
const DUMMY_HASH = '$2y$10$usqgO4wOOLAYyRcnZOMxr.NGzYY3PIhvB4rTgqXV1eN1r/lZ/qxNC';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  return { id: row.id, fullName: row.full_name, email: row.username, role: row.role };
}

/** Public: mint (or reuse) this session's CSRF token. */
router.get('/csrf', (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = newToken();
  req.session.save((err) => {
    if (err) {
      console.error('csrf: session save failed:', err);
      return res.status(500).json({ error: 'Server error.' });
    }
    res.json({ csrfToken: req.session.csrfToken });
  });
});

router.post('/signup', requireCsrf, async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }
    const cleanEmail = String(email).trim();
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 100) {
      return res.status(400).json({ error: 'Enter a valid email address (max 100 characters).' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const cleanRole = role === 'admin' ? 'admin' : 'user';

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [cleanEmail, hash, String(fullName).trim(), cleanRole],
    );
    res.status(201).json({ id: result.insertId, fullName: String(fullName).trim(), email: cleanEmail, role: cleanRole });
  } catch (err) {
    console.error('signup failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/login', requireCsrf, async (req, res) => {
  try {
    const { email, password, remember } = req.body || {};
    // Throttle: max 5 attempts per 60 seconds, tracked per session.
    const now = Date.now();
    const attempts = (req.session.loginAttempts || []).filter((t) => t > now - 60000);
    if (attempts.length >= 5) {
      return res.status(401).json({ error: 'Too many attempts. Try again in a minute.' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, full_name, role FROM users WHERE username = ? LIMIT 1',
      [String(email || '').trim()],
    );
    const user = rows[0];
    const ok = await bcrypt.compare(String(password || ''), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      req.session.loginAttempts = [...attempts, now];
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const csrfToken = req.session.csrfToken; // preserve across regeneration
    await new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
    req.session.userId = user.id;
    req.session.email = user.username;
    req.session.fullName = user.full_name;
    req.session.role = user.role;
    req.session.authenticated = true;
    req.session.csrfToken = csrfToken || newToken();
    req.session.loginAttempts = [];
    if (remember) req.session.cookie.maxAge = 30 * 24 * 3600 * 1000; // 30 days
    await new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));

    res.json({ ...publicUser(user), csrfToken: req.session.csrfToken });
  } catch (err) {
    console.error('login failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/logout', requireCsrf, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('philfida.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, full_name, role FROM users WHERE id = ? LIMIT 1', [
      req.session.userId,
    ]);
    if (!rows[0]) return res.status(401).json({ error: 'Not authenticated.' });
    res.json(publicUser(rows[0]));
  } catch (err) {
    console.error('me failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
