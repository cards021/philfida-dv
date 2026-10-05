"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeStats = computeStats;
async function count(pool, sql) {
    const [rows] = await pool.query(sql);
    const row = rows[0];
    return Number(row?.n ?? 0);
}
/**
 * The dashboard's KPI counts. Shared by the initial page render and the
 * `stats` action so the frontend can refresh the cards after any mutation
 * without re-fetching (and re-filtering) the whole voucher list. Counts are
 * always global — deliberately independent of list search/year/month params.
 */
async function computeStats(pool) {
    const [total, awaiting_receiving, awaiting_releasing, awaiting_check_receiving, awaiting_check_releasing, completed] = await Promise.all([
        count(pool, 'SELECT COUNT(*) AS n FROM vouchers'),
        count(pool, 'SELECT COUNT(*) AS n FROM vouchers WHERE received_at IS NOT NULL'),
        count(pool, 'SELECT COUNT(*) AS n FROM vouchers WHERE released_at IS NOT NULL'),
        count(pool, 'SELECT COUNT(*) AS n FROM vouchers WHERE released_at IS NOT NULL AND check_received_at IS NULL'),
        count(pool, 'SELECT COUNT(*) AS n FROM vouchers WHERE check_received_at IS NOT NULL AND check_released_at IS NULL'),
        count(pool, 'SELECT COUNT(*) AS n FROM vouchers WHERE released_at IS NOT NULL'),
    ]);
    return {
        total,
        awaiting_receiving,
        awaiting_releasing,
        awaiting_check_receiving,
        awaiting_check_releasing,
        completed,
    };
}
//# sourceMappingURL=stats.js.map