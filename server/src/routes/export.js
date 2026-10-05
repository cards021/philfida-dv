"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const excel_js_1 = require("../lib/excel.js");
exports.exportRouter = (0, express_1.Router)();
/**
 * POST /export-dv-excel — fills the official DV Excel template with the
 * posted Create-DV form fields and streams it back as a download.
 * Pure "take this data, hand back a file": no DB access, no CSRF token —
 * and a plain form POST (not fetch) so the browser shows a file-save
 * prompt. Mirrors export_dv_excel.php.
 */
exports.exportRouter.post('/export-dv-excel', auth_js_1.requireAuth, async (req, res) => {
    try {
        const values = (0, excel_js_1.buildDvExcelCellValues)((req.body ?? {}));
        const buffer = await (0, excel_js_1.fillDvExcelTemplate)(values);
        const filename = (0, excel_js_1.safeDvFileName)(req.body?.dv_no);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.setHeader('Cache-Control', 'no-store');
        res.send(buffer);
    }
    catch (err) {
        // Safe to show the real message here: this endpoint only touches the
        // template file and posted form data, never DB credentials or secrets.
        console.error('DV Excel export failed:', err);
        res.status(500).type('text/plain').send(`Could not generate the Excel file.\n\nDetails: ${err.message}`);
    }
});
//# sourceMappingURL=export.js.map