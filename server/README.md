# PhilFIDA DV Tracking — JavaScript backend

Node.js + Express port of the original PHP backend (`api.php`, `login.php`,
`signup.php`, `export_dv_excel.php`). The PHP files are untouched; this runs
alongside them during migration.

## Setup

```bash
cd server
npm install
cp .env.example .env   # fill in DB_* and SESSION_SECRET
npm start              # or: npm run dev (watch mode)
```

Listens on `PORT` (default 3000). Serves the built frontend from
`../client/dist` when present.

## What's here

- `src/index.js` — app wiring, static frontend serving, DB fail-fast check
- `src/routes/api.js` — `GET|POST /api?action=…` (list, create, get, delete,
  mark_received, mark_released, mark_check_received, mark_check_released,
  stats, next_dv_no). Same JSON contract as `api.php`.
- `src/routes/auth.js` — `POST /login`, `POST /signup`, `GET /logout`
- `src/routes/export.js` — `POST /export-dv-excel` (fills the official DV
  `.xlsx` template with exceljs)
- `src/routes/bootstrap.js` — `GET /api/bootstrap` (CSRF token, role, user,
  letterhead logos; replaces the old `window.APP_CONFIG` injection)
- `src/middleware/` — security headers, MySQL-backed sessions, CSRF,
  auth/admin guards
- `src/lib/` — stats queries, next-DV-number logic, Excel cell mapping,
  embedded logos

Sessions are stored in MySQL (`sessions` table, auto-created). Password
hashes are bcrypt and interoperate with the PHP `password_hash()` hashes —
existing users keep their passwords.

## Deploying to Vercel

The repo root has a `vercel.json` wired for a single Vercel project:

- `client/dist` is built and served as static files by Vercel's CDN.
- `api/server.js` runs this Express app as a serverless function for
  `/api/*`, `/login`, `/signup`, `/logout`, and `/export-dv-excel`.

Steps:

1. **Host your MySQL database.** Vercel doesn't provide MySQL — use
   Railway, PlanetScale, Aiven, or any reachable MySQL. Import your
   existing `voucher_tracking` database there (tables `vouchers`, `users`;
   the `sessions` table is created automatically).
2. **Import the repo** into Vercel (root directory = repository root).
3. **Set environment variables** in the Vercel project:
   `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`,
   `DB_SSL=true` (if your provider needs TLS), and a long random
   `SESSION_SECRET`.
4. Deploy. `npm run build` in `client/` and `npm ci` in `server/` run
   automatically via `vercel.json`.

Locally, `npm start` in `server/` still runs the traditional long-lived
server (with the DB fail-fast check).
