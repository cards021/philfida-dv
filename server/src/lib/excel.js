"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDvExcelCellValues = buildDvExcelCellValues;
exports.fillDvExcelTemplate = fillDvExcelTemplate;
exports.safeDvFileName = safeDvFileName;
const node_path_1 = __importDefault(require("node:path"));
const exceljs_1 = __importDefault(require("exceljs"));
/**
 * Maps the Create-DV form fields onto the official DV template's cells.
 * Faithful port of PHP buildDvExcelCellValues(). The template already has
 * all layout/merges baked in; this only writes plain values into cells.
 */
function buildDvExcelCellValues(data) {
    const s = (k) => String(data[k] ?? '');
    const num = (k) => Number(data[k] ?? 0);
    let modeCell = null;
    switch (s('mode_of_payment')) {
        case 'MDS Check':
            modeCell = 'G9';
            break;
        case 'Commercial Check':
            modeCell = 'L9';
            break;
        case 'ADA':
            modeCell = 'S9';
            break;
        case 'Others':
            modeCell = 'W9';
            break;
    }
    const values = {
        AB4: s('fund_cluster').trim(),
        AB5: 'Date : ' + s('date'),
        AB6: 'DV No. : ' + s('dv_no'),
        E11: s('payee'),
        S12: s('tin_employee_no'),
        AB12: s('ors_burs_no'),
        E13: s('address'),
        A17: s('particulars'),
        U17: s('responsibility_center'),
        Y17: s('mfo_pap'),
        AD20: num('net_amount'),
        B30: s('certified_by_name'),
        A36: s('accounting_account_title'),
        S36: s('accounting_uacs_code'),
        E49: s('section_c_name'),
        E51: s('section_c_position'),
        E52: s('section_c_date'),
        W52: s('approved_by_date'),
        S55: 'Bank Name & Account Number: ' + s('bank_name_account'),
        S58: s('receipt_signature_name'),
        AB58: s('receipt_date'),
    };
    if (modeCell)
        values[modeCell] = 'X';
    if (s('mode_of_payment') === 'Others' && s('others_specify') !== '') {
        values['AA10'] = s('others_specify');
    }
    // PHP's empty() also treats "0" as empty — mirror that here.
    if (!['', '0'].includes(s('accounting_debit'))) {
        values['X36'] = num('accounting_debit');
    }
    if (!['', '0'].includes(s('accounting_credit'))) {
        values['AC36'] = num('accounting_credit');
    }
    // Section D's template has no separate Position line — combine name and
    // position onto its one Printed Name line.
    const approvedName = s('approved_by_name').trim();
    const approvedPos = s('approved_by_position').trim();
    if (approvedName !== '' || approvedPos !== '') {
        values['W49'] = approvedPos !== '' ? `${approvedName}, ${approvedPos}` : approvedName;
    }
    if (s('check_ada_no') !== '') {
        values['A55'] = 'Check/   ADA No. : ' + s('check_ada_no');
    }
    if (s('jev_no') !== '') {
        values['AB54'] = 'JEV  No. ' + s('jev_no');
    }
    if (s('official_receipt_no') !== '') {
        values['A59'] = 'Official Receipt No. & Date/Other Documents ' + s('official_receipt_no');
    }
    return values;
}
function templatePath() {
    if (process.env.DV_TEMPLATE_PATH)
        return process.env.DV_TEMPLATE_PATH;
    // server/ lives next to philfida-dv/ in the repo; works from src/ (tsx)
    // and dist/ (compiled) alike.
    const serverRoot = node_path_1.default.resolve(__dirname, '..', '..');
    return node_path_1.default.resolve(serverRoot, '..', 'philfida-dv', 'assets', 'templates', 'dv_template.xlsx');
}
/**
 * Fills the official DV template and returns the finished .xlsx as a
 * Buffer, ready to stream as a download. Throws with an actionable message
 * when the template is missing.
 */
async function fillDvExcelTemplate(values) {
    const tpl = templatePath();
    const workbook = new exceljs_1.default.Workbook();
    try {
        await workbook.xlsx.readFile(tpl);
    }
    catch {
        throw new Error(`The DV Excel template is missing on the server. Expected it at:\n${tpl}\n\nMake sure assets/templates/dv_template.xlsx was uploaded alongside the app.`);
    }
    const sheet = workbook.worksheets[0];
    if (!sheet)
        throw new Error('DV template has no worksheets.');
    for (const [ref, value] of Object.entries(values)) {
        if (value === '' || value === null || value === undefined)
            continue;
        sheet.getCell(ref).value = value;
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
}
function safeDvFileName(dvNo) {
    const clean = String(dvNo ?? '').replace(/[^A-Za-z0-9\-_]/g, '') || 'DV';
    return `DV_${clean}.xlsx`;
}
//# sourceMappingURL=excel.js.map