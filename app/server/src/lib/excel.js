"use strict";
/**
 * Generates a clean, official-looking Disbursement Voucher .xlsx from
 * scratch (no template binary needed) and returns it as a Buffer.
 * Accepts the voucher form fields in camelCase (same shape as the API).
 */
const ExcelJS = require('exceljs');

const GREEN = 'FF0F6B4A';

function str(v) {
  return v === undefined || v === null ? '' : String(v);
}
function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function buildDvWorkbook(v) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PhilFIDA DV Tracking System';
  wb.created = new Date();
  const ws = wb.addWorksheet('Disbursement Voucher', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
    properties: { defaultRowHeight: 16 },
  });
  ws.columns = [{ width: 26 }, { width: 26 }, { width: 26 }, { width: 26 }, { width: 26 }, { width: 26 }];

  const title = (row, text, size) => {
    ws.mergeCells(`A${row}:F${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = text;
    c.font = { bold: true, size };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  };
  const sec = (row, text) => {
    ws.mergeCells(`A${row}:F${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = text;
    c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    c.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(row).height = 20;
  };
  const lbl = (cell, text) => {
    const c = ws.getCell(cell);
    c.value = text;
    c.font = { bold: true, size: 10 };
    c.alignment = { vertical: 'middle' };
  };
  const put = (cell, value, opts = {}) => {
    const c = ws.getCell(cell);
    c.value = value === undefined || value === null ? '' : value;
    c.font = { size: 10, italic: !!opts.italic, bold: !!opts.bold };
    c.alignment = { vertical: 'middle', wrapText: !!opts.wrap, horizontal: opts.align || 'left' };
    if (opts.numFmt) c.numFmt = opts.numFmt;
    return c;
  };
  const mergeVal = (from, to, value, opts) => {
    ws.mergeCells(`${from}:${to}`);
    return put(from, value, opts);
  };

  // ---- Letterhead ----
  title(1, 'REPUBLIC OF THE PHILIPPINES', 12);
  title(2, 'Philippine Fiber Industry Development Authority (PhilFIDA)', 11);
  title(3, 'DISBURSEMENT VOUCHER', 16);

  // ---- Header fields ----
  lbl('A5', 'Fund Cluster:'); mergeVal('B5', 'C5', str(v.fundCluster));
  lbl('D5', 'Date:'); put('E5', str(v.date));
  lbl('A6', 'DV No.:'); mergeVal('B6', 'C6', str(v.dvNo), { bold: true });
  lbl('A7', 'Payee:'); mergeVal('B7', 'F7', str(v.payee), { bold: true });
  lbl('A8', 'TIN / Employee No.:'); mergeVal('B8', 'C8', str(v.tinOrEmployeeNo));
  lbl('D8', 'ORS / BURS No.:'); mergeVal('E8', 'F8', str(v.orsBursNo));
  lbl('A9', 'Address:'); mergeVal('B9', 'F9', str(v.address), { wrap: true });
  lbl('A10', 'Particulars:'); mergeVal('B10', 'F10', str(v.particulars), { wrap: true });
  ws.getRow(10).height = 36;
  lbl('A11', 'Responsibility Center:'); mergeVal('B11', 'C11', str(v.responsibilityCenter));
  lbl('D11', 'MFO / PAP:'); mergeVal('E11', 'F11', str(v.mfoPap));

  // ---- Mode of payment ----
  lbl('A13', 'Mode of Payment:');
  const modes = ['MDS Check', 'Commercial Check', 'ADA', 'Others'];
  const cells = ['B14', 'C14', 'D14', 'E14'];
  modes.forEach((mode, i) => {
    let text = (str(v.modeOfPayment) === mode ? '☒ ' : '☐ ') + mode;
    if (mode === 'Others' && str(v.modeOfPayment) === 'Others' && str(v.othersSpecify)) {
      text += ': ' + str(v.othersSpecify);
    }
    put(cells[i], text);
  });

  // ---- Amounts ----
  lbl('A16', 'GROSS AMOUNT'); mergeVal('B16', 'C16', money(v.grossAmount), { numFmt: '#,##0.00', align: 'right' });
  put('A17', 'Less: Tax').alignment = { horizontal: 'right', vertical: 'middle' };
  mergeVal('B17', 'C17', money(v.lessTax), { numFmt: '#,##0.00', align: 'right' });
  lbl('A18', 'NET AMOUNT'); mergeVal('B18', 'C18', money(v.netAmount), { numFmt: '#,##0.00', align: 'right', bold: true });
  lbl('A19', 'Amount in Words:'); mergeVal('B19', 'F19', str(v.amountInWords), { italic: true, wrap: true });

  // ---- A. Certification ----
  sec(21, 'A.  CERTIFICATION');
  mergeVal('A22', 'F22', 'I hereby certify that the above information is true and correct.', { wrap: true });
  lbl('A23', 'Printed Name:'); mergeVal('B23', 'C23', str(v.certifiedByName));
  lbl('D23', 'Position / Designation:'); mergeVal('E23', 'F23', str(v.certifiedByDesignation));
  lbl('A24', 'Date:'); mergeVal('B24', 'C24', str(v.certifiedByDate));

  // ---- B. Accounting entry ----
  sec(26, 'B.  ACCOUNTING ENTRY');
  lbl('A27', 'Account Title'); mergeVal('B27', 'C27', 'UACS Code');
  lbl('D27', 'Debit'); lbl('E27', 'Credit');
  put('A28', str(v.accountingAccountTitle), { wrap: true });
  mergeVal('B28', 'C28', str(v.accountingUacsCode));
  put('D28', money(v.accountingDebit), { numFmt: '#,##0.00', align: 'right' });
  put('E28', money(v.accountingCredit), { numFmt: '#,##0.00', align: 'right' });

  // ---- C. Approval ----
  sec(30, 'C.  APPROVAL');
  lbl('A31', 'Approved by:'); mergeVal('B31', 'C31', str(v.approvedByName));
  lbl('D31', 'Position:'); mergeVal('E31', 'F31', str(v.approvedByPosition));
  lbl('A32', 'Date:'); mergeVal('B32', 'C32', str(v.approvedByDate));
  lbl('D32', 'Section C — Name:'); mergeVal('E32', 'F32', str(v.sectionCName));
  lbl('A33', 'Section C — Position:'); mergeVal('B33', 'C33', str(v.sectionCPosition));
  lbl('D33', 'Section C — Date:'); mergeVal('E33', 'F33', str(v.sectionCDate));

  // ---- D. Receipt of payment ----
  sec(35, 'D.  RECEIPT OF PAYMENT');
  lbl('A36', 'Check / ADA No.:'); mergeVal('B36', 'C36', str(v.checkAdaNo));
  lbl('D36', 'Bank Name & Account:'); mergeVal('E36', 'F36', str(v.bankNameAccount), { wrap: true });
  lbl('A37', 'Received by (signature):'); mergeVal('B37', 'C37', str(v.receiptSignatureName));
  lbl('D37', 'Date:'); mergeVal('E37', 'F37', str(v.receiptDate));
  lbl('A38', 'Official Receipt No.:'); mergeVal('B38', 'C38', str(v.officialReceiptNo));
  lbl('D38', 'JEV No.:'); mergeVal('E38', 'F38', str(v.jevNo));

  // ---- System tracking ----
  sec(40, 'SYSTEM TRACKING');
  lbl('A41', 'Received at:'); mergeVal('B41', 'C41', str(v.receivedAt));
  lbl('D41', 'Released at:'); mergeVal('E41', 'F41', str(v.releasedAt));
  lbl('A42', 'Check received at:'); mergeVal('B42', 'C42', str(v.checkReceivedAt));
  lbl('D42', 'Check released at:'); mergeVal('E42', 'F42', str(v.checkReleasedAt));
  lbl('A43', 'Received remarks:'); mergeVal('B43', 'C43', str(v.receivedRemarks), { wrap: true });
  lbl('D43', 'Released remarks:'); mergeVal('E43', 'F43', str(v.releasedRemarks), { wrap: true });

  // Thin border around the whole form.
  const thin = { style: 'thin', color: { argb: 'FF9CA3AF' } };
  for (let r = 1; r <= 43; r++) {
    for (let col = 1; col <= 6; col++) {
      ws.getCell(r, col).border = { top: thin, left: thin, bottom: thin, right: thin };
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function dvFileName(dvNo) {
  const clean = String(dvNo || '').replace(/[^A-Za-z0-9\-_]/g, '') || 'draft';
  return `DV_${clean}.xlsx`;
}

module.exports = { buildDvWorkbook, dvFileName };
