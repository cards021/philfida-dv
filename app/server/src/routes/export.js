"use strict";
/**
 * POST /api/export/excel — fills an official-looking DV spreadsheet from the
 * posted voucher form fields (camelCase) and streams it as a download.
 * Deliberately NO CSRF token: like the legacy app, this is a plain HTML form
 * POST so the browser shows a file-save prompt (fetch can't do that).
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.js');
const { buildDvWorkbook, dvFileName } = require('../lib/excel.js');

const router = Router();

router.post('/excel', requireAuth, async (req, res) => {
  try {
    const buffer = await buildDvWorkbook(req.body || {});
    const filename = dvFileName((req.body || {}).dvNo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    // Safe to surface details: this endpoint only touches posted form data,
    // never DB credentials or secrets.
    console.error('excel export failed:', err);
    res.status(500).type('text/plain').send(`Could not generate the Excel file. Details: ${err.message}`);
  }
});

module.exports = router;
