# PhilFIDA DV Tracking — JavaScript frontend

Vanilla JavaScript + Vite port of the original frontend (`dashboard.php` +
`assets/js/dashboard.js`, `login.php`, `signup.php`). Talks to the new
backend in `../server` (same `?action=` JSON contract, session cookie auth).

## Setup

```bash
cd client
npm install
npm run build     # outputs to dist/ (served by the backend)
npm run dev       # local dev server (proxies /api to the backend)
```

## What's here

- `index.html` — dashboard shell (voucher table, KPI cards, modals)
- `login.html`, `signup.html` — auth pages (forms POST to `/login`, `/signup`)
- `src/` — ES modules: `main.js` (startup, fetches `/api/bootstrap`),
  `api.js` (fetch helpers + CSRF header), `table.js` (rendering, sorting,
  filters), `modals.js`, `dvform.js` (create-DV form + Excel/PDF export),
  `qr.js` (QR generation + scanner), `state.js`, `config.js`, `utils.js`
  (XSS escaping helpers)

On startup the app fetches `GET /api/bootstrap` for its CSRF token, role,
user info, and letterhead logos (replaces the old `window.APP_CONFIG`
injection), and redirects to `login.html` on 401.
