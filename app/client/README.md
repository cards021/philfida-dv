# PhilFIDA Disbursement Voucher Tracking — Frontend

Greenfield responsive web frontend for the PhilFIDA DV Tracking System.
Vite + vanilla JavaScript (no frameworks, no CSS framework — all styling is
custom mobile-first CSS in `src/styles.css`).

## Setup

```bash
npm install
npm run dev      # dev server with /api proxied to http://127.0.0.1:3000
npm run build    # production build → dist/
npm run preview  # preview the production build
```

The backend is built in parallel against the same API contract
(`GET /api/auth/csrf`, `/api/auth/*`, `/api/vouchers/*`, `/api/export/excel`).

## Pages (multi-page build)

- `login.html` / `signup.html` — centered auth cards; forms submit as JSON
  with an `X-CSRF-Token` fetched from `GET /api/auth/csrf`.
- `index.html` — the dashboard (requires auth; any 401 redirects to login).

## Dashboard features

- Header with hamburger nav on mobile, user chip, sign-out
- 5 clickable KPI cards (Total / Pending / Received / In Check / Completed)
- Collapsible filter bar (search, year, month, status) + pagination
- Voucher table with sticky first column on small screens, status pills,
  per-row actions: view, QR, edit, next workflow stage, delete (admin only)
- Create/Edit modal with all voucher fields in sections (info, amounts,
  certification, accounting, approval, check & receipt); net auto-calc
- Detail drawer with full field list + workflow timeline
- Workflow: Mark Received / Mark Released (with remarks) → Check Received →
  Check Released, stage-appropriate enabling
- QR code per voucher (`qrcode`) + QR scanner (`html5-qrcode`) with manual
  DV-number fallback
- Export Excel via hidden form POST to `/api/export/excel` (file download)
- Print/PDF via a print stylesheet rendering the official DV document
- Toasts, XSS-escaped rendering, ≥44px touch targets

## Responsive design

Breakpoints at 640px and 1024px: KPIs 2→3→5 columns, filters collapse
behind a toggle on mobile, modals become full-screen sheets, the detail
view is a slide-over drawer, and tables scroll horizontally.
