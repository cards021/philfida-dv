"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../middleware/auth.js");
const csrf_js_1 = require("../middleware/csrf.js");
const stats_js_1 = require("../lib/stats.js");
const dvno_js_1 = require("../lib/dvno.js");
exports.apiRouter = (0, express_1.Router)();
// Every /api call needs an authenticated session (mirrors api.php's guard).
exports.apiRouter.use(auth_js_1.requireAuth);
const STATE_CHANGING = new Set([
    'create',
    'delete',
    'mark_received',
    'mark_released',
    'mark_check_received',
    'mark_check_released',
]);
exports.apiRouter.use('/api', (req, res, next) => {
    const action = String(req.query.action ?? '');
    if (STATE_CHANGING.has(action)) {
        (0, csrf_js_1.requireCsrf)(req, res, next);
        return;
    }
    next();
});
function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function emptyToNull(v) {
    const s = String(v ?? '').trim();
    return s === '' ? null : String(v ?? '');
}
function str(v) {
    return String(v ?? '');
}
async function handleList(req, res) {
    const search = String(req.query.search ?? '');
    const year = String(req.query.year ?? '');
    const month = String(req.query.month ?? '');
    const where = [];
    const params = [];
    if (search) {
        where.push('(dv_no LIKE ? OR payee LIKE ? OR particulars LIKE ?)');
        const sp = `%${search}%`;
        params.push(sp, sp, sp);
    }
    if (year !== '' && /^\d+$/.test(year)) {
        where.push('YEAR(date) = ?');
        params.push(Number.parseInt(year, 10));
    }
    if (month !== '' && /^\d+$/.test(month)) {
        const m = Number.parseInt(month, 10);
        if (m >= 1 && m <= 12) {
            where.push('MONTH(date) = ?');
            params.push(m);
        }
    }
    let sql = 'SELECT * FROM vouchers';
    if (where.length > 0)
        sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db_js_1.pool.query(sql, params);
    res.json(rows);
}
const VOUCHER_COLUMNS = [
    'dv_no', 'payee', 'particulars', 'gross_amount', 'less_tax', 'net_amount', 'created_by',
    'fund_cluster', 'date', 'mode_of_payment', 'others_specify', 'tin_employee_no', 'ors_burs_no',
    'address', 'responsibility_center', 'mfo_pap', 'amount_in_words',
    'certified_by_name', 'certified_by_designation', 'certified_by_date',
    'accounting_account_title', 'accounting_uacs_code', 'accounting_debit', 'accounting_credit',
    'section_c_name', 'section_c_position', 'section_c_date',
    'approved_by_name', 'approved_by_position', 'approved_by_date',
    'check_ada_no', 'bank_name_account', 'receipt_signature_name', 'receipt_date', 'official_receipt_no', 'jev_no',
    'received_at', 'received_remarks', 'released_at', 'released_remarks',
    'check_received_at', 'check_released_at',
];
async function handleCreate(req, res) {
    const data = (req.body ?? {});
    const placeholders = VOUCHER_COLUMNS.map((c) => `:${c}`).join(', ');
    const params = {
        dv_no: str(data.dv_no),
        payee: str(data.payee),
        particulars: str(data.particulars),
        gross_amount: toNumber(data.gross_amount),
        less_tax: toNumber(data.less_tax),
        net_amount: toNumber(data.net_amount),
        created_by: str(data.created_by) || 'Clerk',
        fund_cluster: str(data.fund_cluster),
        date: emptyToNull(data.date),
        mode_of_payment: str(data.mode_of_payment),
        others_specify: str(data.others_specify),
        tin_employee_no: str(data.tin_employee_no),
        ors_burs_no: str(data.ors_burs_no),
        address: str(data.address),
        responsibility_center: str(data.responsibility_center),
        mfo_pap: str(data.mfo_pap),
        amount_in_words: str(data.amount_in_words),
        certified_by_name: str(data.certified_by_name),
        certified_by_designation: str(data.certified_by_designation),
        certified_by_date: emptyToNull(data.certified_by_date),
        accounting_account_title: str(data.accounting_account_title),
        accounting_uacs_code: str(data.accounting_uacs_code),
        accounting_debit: toNumber(data.accounting_debit),
        accounting_credit: toNumber(data.accounting_credit),
        section_c_name: str(data.section_c_name),
        section_c_position: str(data.section_c_position),
        section_c_date: emptyToNull(data.section_c_date),
        approved_by_name: str(data.approved_by_name),
        approved_by_position: str(data.approved_by_position),
        approved_by_date: emptyToNull(data.approved_by_date),
        check_ada_no: str(data.check_ada_no),
        bank_name_account: str(data.bank_name_account),
        receipt_signature_name: str(data.receipt_signature_name),
        receipt_date: emptyToNull(data.receipt_date),
        official_receipt_no: str(data.official_receipt_no),
        jev_no: str(data.jev_no),
        received_at: emptyToNull(data.received_at),
        received_remarks: str(data.received_remarks),
        released_at: emptyToNull(data.released_at),
        released_remarks: str(data.released_remarks),
        check_received_at: emptyToNull(data.check_received_at),
        check_released_at: emptyToNull(data.check_released_at),
    };
    const [result] = await db_js_1.pool.query(`INSERT INTO vouchers (${VOUCHER_COLUMNS.join(', ')}) VALUES (${placeholders})`, params);
    const insertId = result.insertId;
    res.json({ success: true, id: insertId });
}
async function handleGet(req, res) {
    // Prefer lookup by primary key so vouchers without a DV No. are still
    // found reliably; fall back to dv_no for QR scans.
    const id = String(req.query.id ?? '');
    const dv = String(req.query.dv ?? '');
    let rows;
    if (id !== '') {
        [rows] = await db_js_1.pool.query('SELECT * FROM vouchers WHERE id = ?', [id]);
    }
    else {
        [rows] = await db_js_1.pool.query('SELECT * FROM vouchers WHERE dv_no = ?', [dv]);
    }
    const row = rows[0];
    res.json(row ?? { error: 'Voucher not found' });
}
async function handleDelete(req, res) {
    const data = (req.body ?? {});
    const id = data.id;
    const dvNo = data.dv_no;
    let result;
    if (id) {
        [result] = await db_js_1.pool.query('DELETE FROM vouchers WHERE id = ?', [id]);
    }
    else if (dvNo !== undefined && dvNo !== '') {
        [result] = await db_js_1.pool.query('DELETE FROM vouchers WHERE dv_no = ?', [dvNo]);
    }
    else {
        res.json({ error: 'Voucher ID is required' });
        return;
    }
    if (result.affectedRows > 0) {
        res.json({ success: true, message: 'Voucher deleted successfully' });
    }
    else {
        res.json({ error: 'Voucher not found or already deleted' });
    }
}
async function handleMark(req, res, sql, withRemarks) {
    const data = (req.body ?? {});
    const id = data.id;
    if (!id) {
        res.json({ error: 'Voucher ID is required' });
        return;
    }
    const params = withRemarks ? [String(data.remarks ?? '').trim(), id] : [id];
    await db_js_1.pool.query(sql, params);
    res.json({ success: true });
}
exports.apiRouter.all('/api', async (req, res) => {
    const action = String(req.query.action ?? '');
    try {
        switch (action) {
            case 'list':
                await handleList(req, res);
                break;
            case 'create':
                await handleCreate(req, res);
                break;
            case 'get':
                await handleGet(req, res);
                break;
            case 'delete':
                await new Promise((resolve, reject) => {
                    (0, auth_js_1.requireAdmin)(req, res, (err) => (err ? reject(err) : resolve()));
                });
                if (res.headersSent)
                    return;
                await handleDelete(req, res);
                break;
            case 'mark_received':
                await handleMark(req, res, 'UPDATE vouchers SET received_at = NOW(), received_remarks = ? WHERE id = ?', true);
                break;
            case 'mark_released':
                await handleMark(req, res, 'UPDATE vouchers SET released_at = NOW(), released_remarks = ? WHERE id = ?', true);
                break;
            case 'mark_check_received':
                await handleMark(req, res, 'UPDATE vouchers SET check_received_at = NOW() WHERE id = ?', false);
                break;
            case 'mark_check_released':
                await handleMark(req, res, 'UPDATE vouchers SET check_released_at = NOW() WHERE id = ?', false);
                break;
            case 'stats':
                res.json(await (0, stats_js_1.computeStats)(db_js_1.pool));
                break;
            case 'next_dv_no':
                res.json({ dv_no: await (0, dvno_js_1.nextDvNo)(db_js_1.pool) });
                break;
            default:
                res.status(400).json({ error: 'Unknown action.' });
        }
    }
    catch (err) {
        // Log the real error server-side; never hand internals (table/column
        // names, query fragments) back to the browser.
        console.error(`Voucher action "${action}" failed:`, err);
        if (!res.headersSent)
            res.status(500).json({ error: 'Server error. Please try again or contact the system administrator.' });
    }
});
//# sourceMappingURL=api.js.map