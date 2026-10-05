"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextDvNo = nextDvNo;
/**
 * Picks up right after whatever DV No. was actually typed in last, rather
 * than a plain row count (which drifts once vouchers are deleted or DV
 * numbers aren't entered in strict order). Keeps the same zero-padded width
 * ("0045" -> "0046", "1251" -> "1252"), widening only on overflow.
 */
async function nextDvNo(pool) {
    const [rows] = await pool.query("SELECT dv_no FROM vouchers WHERE dv_no IS NOT NULL AND dv_no != '' ORDER BY id DESC LIMIT 1");
    const last = rows[0]?.dv_no ?? '';
    const m = /^(.*?)(\d+)$/.exec(last);
    if (!m)
        return '0001';
    const [, prefix, digits] = m;
    const incremented = String(Number.parseInt(digits, 10) + 1);
    return prefix + incremented.padStart(digits.length, '0');
}
//# sourceMappingURL=dvno.js.map