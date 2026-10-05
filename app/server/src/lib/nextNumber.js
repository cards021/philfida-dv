"use strict";
/**
 * Next DV number: picks up after whatever dv_no was actually typed in last
 * (not a row count, which drifts when vouchers are deleted or numbers are
 * entered out of order). Preserves the zero-padded width ("0045" -> "0046"),
 * widening only when the increment overflows it. Defaults to '0001'.
 */
async function nextDvNumber(pool) {
  const [rows] = await pool.query(
    "SELECT dv_no FROM vouchers WHERE dv_no IS NOT NULL AND dv_no != '' ORDER BY id DESC LIMIT 1",
  );
  const last = rows[0] ? String(rows[0].dv_no) : '';
  const m = /^(.*?)(\d+)$/.exec(last);
  if (!m) return '0001';
  const incremented = String(parseInt(m[2], 10) + 1);
  return m[1] + incremented.padStart(m[2].length, '0');
}

module.exports = { nextDvNumber };
