"use strict";
/**
 * Voucher routes. All require authentication; POST/PATCH/DELETE additionally
 * require the X-CSRF-Token header. JSON uses flat camelCase (see mapper.js).
 */
const { Router } = require('express');
const { pool } = require('../db.js');
const { requireAuth, requireAdmin } = require('../middleware/auth.js');
const { requireCsrf } = require('../middleware/csrf.js');
const { qi, toVoucher, toColumns } = require('../mapper.js');
const { STATUS_WHERE, STATUSES } = require('../lib/status.js');
const { nextDvNumber } = require('../lib/nextNumber.js');

const router = Router();
router.use(requireAuth);

function parseId(param) {
  const id = parseInt(param, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function fetchVoucher(id) {
  const [rows] = await pool.query('SELECT * FROM vouchers WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

/** GET /api/vouchers/stats — the dashboard KPI counts. */
router.get('/stats', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total,
        SUM(received_at IS NULL) AS pending,
        SUM(received_at IS NOT NULL AND released_at IS NULL) AS received,
        SUM(released_at IS NOT NULL AND check_received_at IS NULL) AS released,
        SUM(check_received_at IS NOT NULL AND check_released_at IS NULL) AS in_check,
        SUM(check_released_at IS NOT NULL) AS completed
       FROM vouchers`,
    );
    const r = rows[0] || {};
    const n = (v) => (v === null || v === undefined ? 0 : Number(v));
    res.json({
      total: n(r.total),
      pending: n(r.pending),
      received: n(r.received),
      released: n(r.released),
      inCheck: n(r.in_check),
      completed: n(r.completed),
    });
  } catch (err) {
    console.error('stats failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/** GET /api/vouchers/next-number — suggested DV number for the create form. */
router.get('/next-number', async (req, res) => {
  try {
    res.json({ dvNo: await nextDvNumber(pool) });
  } catch (err) {
    console.error('next-number failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/** GET /api/vouchers?search=&year=&month=&status=&page=&limit= */
router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '');
    const year = String(req.query.year || '');
    const month = String(req.query.month || '');
    const status = String(req.query.status || '');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Use one of: ${STATUSES.join(', ')}.` });
    }

    const where = [];
    const params = [];
    if (search) {
      where.push('(dv_no LIKE ? OR payee LIKE ? OR particulars LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (/^\d+$/.test(year)) {
      where.push('YEAR(`date`) = ?');
      params.push(parseInt(year, 10));
    }
    if (/^\d+$/.test(month)) {
      const m = parseInt(month, 10);
      if (m >= 1 && m <= 12) {
        where.push('MONTH(`date`) = ?');
        params.push(m);
      }
    }
    if (status) where.push(STATUS_WHERE[status]);
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM vouchers ${clause}`, params);
    const total = Number(countRows[0].total);
    const [rows] = await pool.query(
      `SELECT * FROM vouchers ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );
    res.json({ data: rows.map(toVoucher), total, page, limit });
  } catch (err) {
    console.error('list vouchers failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/** POST /api/vouchers — create. */
router.post('/', requireCsrf, async (req, res) => {
  try {
    const cols = toColumns(req.body || {});
    if (!cols.created_by) cols.created_by = req.session.fullName || 'Clerk';
    const keys = Object.keys(cols);
    if (!keys.length) return res.status(400).json({ error: 'No voucher data provided.' });
    const [result] = await pool.query(
      `INSERT INTO vouchers (${keys.map(qi).join(', ')}) VALUES (${keys.map((k) => `:${k}`).join(', ')})`,
      cols,
    );
    const row = await fetchVoucher(result.insertId);
    res.status(201).json(toVoucher(row));
  } catch (err) {
    console.error('create voucher failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/** GET /api/vouchers/:id */
router.get('/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const row = id ? await fetchVoucher(id) : null;
    if (!row) return res.status(404).json({ error: 'Voucher not found.' });
    res.json(toVoucher(row));
  } catch (err) {
    console.error('get voucher failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/** PATCH /api/vouchers/:id — partial update. */
router.patch('/:id', requireCsrf, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Voucher not found.' });
    const cols = toColumns(req.body || {});
    const keys = Object.keys(cols);
    if (!keys.length) return res.status(400).json({ error: 'No fields to update.' });
    const [result] = await pool.query(`UPDATE vouchers SET ${keys.map((k) => `${qi(k)} = :${k}`).join(', ')} WHERE id = :id`, {
      ...cols,
      id,
    });
    if (!result.affectedRows) return res.status(404).json({ error: 'Voucher not found.' });
    res.json(toVoucher(await fetchVoucher(id)));
  } catch (err) {
    console.error('update voucher failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/** DELETE /api/vouchers/:id — admin only. */
router.delete('/:id', requireCsrf, requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Voucher not found.' });
    const [result] = await pool.query('DELETE FROM vouchers WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Voucher not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('delete voucher failed:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/** Workflow transitions — each stamps NOW() and returns the updated voucher. */
async function transition(id, setClause, params, res) {
  const [result] = await pool.query(`UPDATE vouchers SET ${setClause} WHERE id = ?`, [...params, id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Voucher not found.' });
  res.json(toVoucher(await fetchVoucher(id)));
}

function transitionRoute(path, setClause, withRemarks) {
  router.post(path, requireCsrf, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(404).json({ error: 'Voucher not found.' });
      const params = withRemarks ? [String((req.body || {}).remarks || '').trim()] : [];
      await transition(id, setClause, params, res);
    } catch (err) {
      console.error(`transition ${path} failed:`, err);
      res.status(500).json({ error: 'Server error.' });
    }
  });
}

transitionRoute('/:id/receive', 'received_at = NOW(), received_remarks = ?', true);
transitionRoute('/:id/release', 'released_at = NOW(), released_remarks = ?', true);
transitionRoute('/:id/check-receive', 'check_received_at = NOW()', false);
transitionRoute('/:id/check-release', 'check_released_at = NOW()', false);

module.exports = router;
