"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_js_1 = require("../db.js");
const csrf_js_1 = require("../middleware/csrf.js");
exports.authRouter = (0, express_1.Router)();
const REMEMBER_ME_SECONDS = 60 * 60 * 24 * 30;
// Static dummy bcrypt hash used when the account doesn't exist, so "wrong
// password" and "no such user" take the same time (mirrors login.php).
const DUMMY_HASH = '$2y$10$usqgO4wOOLAYyRcnZOMxr.NGzYY3PIhvB4rTgqXV1eN1r/lZ/qxNC';
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function loginError(res, message) {
    res.redirect('/login.html?error=' + encodeURIComponent(message));
}
/**
 * POST /login — form POST (email, password, remember, csrf_token).
 * Mirrors login.php: throttling, CSRF check, timing-safe password verify,
 * session regeneration, optional 30-day "remember me" cookie.
 */
exports.authRouter.post('/login', csrf_js_1.ensureCsrfToken, async (req, res) => {
    const email = String(req.body.email ?? '').trim();
    const password = String(req.body.password ?? '');
    const csrf = String(req.body.csrf_token ?? '');
    const remember = String(req.body.remember ?? '') === '1';
    // Throttle: max 5 attempts per 60 seconds, tracked per session.
    const now = Date.now();
    const attempts = (req.session.login_attempts ?? []).filter((t) => t > now - 60_000);
    req.session.login_attempts = attempts;
    if (req.session.csrf_token !== csrf || csrf === '') {
        loginError(res, 'Your session expired. Please refresh the page and try again.');
        return;
    }
    if (attempts.length >= 5) {
        loginError(res, 'Too many attempts. Please wait a minute and try again.');
        return;
    }
    if (email === '' || password === '') {
        loginError(res, 'Please enter both your email and password.');
        return;
    }
    if (email.length > 100 || password.length > 200) {
        req.session.login_attempts = [...attempts, now];
        loginError(res, 'Incorrect email or password.');
        return;
    }
    if (!isValidEmail(email)) {
        loginError(res, 'Please enter a valid email address.');
        return;
    }
    try {
        const [rows] = await db_js_1.pool.query('SELECT id, username, password_hash, full_name, role FROM users WHERE username = ? LIMIT 1', [email]);
        const account = rows[0];
        const hashToCheck = account?.password_hash ?? DUMMY_HASH;
        const passwordOk = await bcryptjs_1.default.compare(password, hashToCheck);
        if (!account || !passwordOk) {
            req.session.login_attempts = [...attempts, now];
            loginError(res, 'Incorrect email or password.');
            return;
        }
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => (err ? reject(err) : resolve()));
        });
        req.session.authenticated = true;
        req.session.user_id = account.id;
        req.session.username = account.username;
        req.session.full_name = account.full_name;
        req.session.role = account.role === 'admin' ? 'admin' : 'user';
        req.session.login_attempts = [];
        if (remember) {
            req.session.cookie.maxAge = REMEMBER_ME_SECONDS * 1000;
        }
        // Fresh CSRF token after login (session was regenerated).
        req.session.csrf_token = (0, node_crypto_1.randomBytes)(32).toString('hex');
        await new Promise((resolve, reject) => {
            req.session.save((err) => (err ? reject(err) : resolve()));
        });
        res.redirect('/');
    }
    catch (err) {
        console.error('Login failed:', err);
        loginError(res, 'Something went wrong. Please try again.');
    }
});
/**
 * POST /signup — form POST (full_name, email, password, confirm_password,
 * role). Mirrors signup.php validation, then redirects to the login page.
 */
exports.authRouter.post('/signup', async (req, res) => {
    if (req.session.authenticated) {
        res.redirect('/');
        return;
    }
    const fullName = String(req.body.full_name ?? '').trim();
    const email = String(req.body.email ?? '').trim();
    const password = String(req.body.password ?? '');
    const confirm = String(req.body.confirm_password ?? '');
    const role = String(req.body.role ?? '') === 'admin' ? 'admin' : 'user';
    const fail = (message) => {
        res.redirect('/signup.html?error=' + encodeURIComponent(message));
    };
    if (fullName === '' || email === '' || password === '') {
        fail('Please fill in every field.');
        return;
    }
    if (!isValidEmail(email) || email.length > 100) {
        fail('Please enter a valid email address.');
        return;
    }
    if (password.length < 6) {
        fail('Password must be at least 6 characters.');
        return;
    }
    if (password !== confirm) {
        fail('Passwords do not match.');
        return;
    }
    try {
        const [existing] = await db_js_1.pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [email]);
        if (existing.length > 0) {
            fail('That email address is already registered.');
            return;
        }
        const hash = await bcryptjs_1.default.hash(password, 10);
        await db_js_1.pool.query('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)', [
            email,
            hash,
            fullName,
            role,
        ]);
        res.redirect('/login.html?registered=1');
    }
    catch (err) {
        console.error('Signup failed:', err);
        fail('Something went wrong. Please try again.');
    }
});
/** GET /logout — destroys the session, back to the login page. */
exports.authRouter.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('philfida.sid');
        res.redirect('/login.html');
    });
});
//# sourceMappingURL=auth.js.map