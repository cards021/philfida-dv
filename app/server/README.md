# PhilFIDA Disbursement Voucher Tracking — backend

Greenfield JavaScript backend (Node.js + Express, CommonJS) for the PhilFIDA
Disbursement Voucher Tracking System. Same-origin session-cookie auth; the
frontend (built separately against the contract below) talks to these routes.

## Setup

```bash
npm install
cp .env.example .env        # fill in DB_* and SESSION_SECRET (never commit .env)
mysql -u root < schema.sql  # or: npm run seed  (also creates the admin user)
npm run seed                # needs ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env
npm start                   # node src/index.js  (npm run dev for watch mode)
```

Listens on `PORT` (default 3000). Fails fast at startup if MySQL is
unreachable. The `sessions` table is created automatically on first use.

## Auth flow (SPA)

1. `GET /api/auth/csrf` → `{csrfToken}` (public; establishes the session)
2. Send `X-CSRF-Token: <token>` on every POST/PATCH/DELETE below.

## Endpoints

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/health` | – | – | `{ok:true}` |
| GET | `/api/auth/csrf` | – | – | `{csrfToken}` |
| POST | `/api/auth/signup` | CSRF | `{fullName,email,password,role?}` | `201 {id,fullName,email,role}` |
| POST | `/api/auth/login` | CSRF | `{email,password,remember?}` | `200 {id,fullName,email,role,csrfToken}` |
| POST | `/api/auth/logout` | CSRF | – | `{ok:true}` |
| GET | `/api/auth/me` | yes | – | `{id,fullName,email,role}` |
| GET | `/api/vouchers` | yes | `?search=&year=&month=&status=&page=&limit=` | `{data,total,page,limit}` |
| POST | `/api/vouchers` | yes+CSRF | voucher fields (camelCase) | `201 Voucher` |
| GET | `/api/vouchers/stats` | yes | – | `{total,pending,received,released,inCheck,completed}` |
| GET | `/api/vouchers/next-number` | yes | – | `{dvNo}` |
| GET | `/api/vouchers/:id` | yes | – | `Voucher` |
| PATCH | `/api/vouchers/:id` | yes+CSRF | partial voucher fields | `Voucher` |
| DELETE | `/api/vouchers/:id` | admin+CSRF | – | `{ok:true}` |
| POST | `/api/vouchers/:id/receive` | yes+CSRF | `{remarks?}` | `Voucher` |
| POST | `/api/vouchers/:id/release` | yes+CSRF | `{remarks?}` | `Voucher` |
| POST | `/api/vouchers/:id/check-receive` | yes+CSRF | – | `Voucher` |
| POST | `/api/vouchers/:id/check-release` | yes+CSRF | – | `Voucher` |
| POST | `/api/export/excel` | yes (no CSRF — plain form POST) | voucher fields (camelCase) | `DV_<dvNo>.xlsx` download |

Voucher JSON is flat camelCase (`dvNo`, `grossAmount`, `tinOrEmployeeNo`,
`checkReceivedAt`, …); the DB stays snake_case and legacy-compatible.

**Statuses** (used by `?status=` and `stats`): `pending` (not received),
`received`, `released`, `in_check` (check received, not released),
`completed` (check released).

**Errors:** `401 {error}` unauthenticated · `403 {error}` bad CSRF / not
admin · `400 {error}` validation · `404 {error}` not found · `500 {error}`
server fault (real error logged server-side only, never leaked).
