"use strict";
/**
 * Maps DB snake_case columns to the API's flat camelCase voucher shape and
 * back. Column names are kept EXACT (including `date`) so the table stays
 * compatible with the legacy database.
 */

const COLUMN_TO_CAMEL = {
  id: 'id',
  dv_no: 'dvNo',
  payee: 'payee',
  particulars: 'particulars',
  gross_amount: 'grossAmount',
  less_tax: 'lessTax',
  net_amount: 'netAmount',
  created_by: 'createdBy',
  fund_cluster: 'fundCluster',
  date: 'date',
  mode_of_payment: 'modeOfPayment',
  others_specify: 'othersSpecify',
  tin_employee_no: 'tinOrEmployeeNo',
  ors_burs_no: 'orsBursNo',
  address: 'address',
  responsibility_center: 'responsibilityCenter',
  mfo_pap: 'mfoPap',
  amount_in_words: 'amountInWords',
  certified_by_name: 'certifiedByName',
  certified_by_designation: 'certifiedByDesignation',
  certified_by_date: 'certifiedByDate',
  accounting_account_title: 'accountingAccountTitle',
  accounting_uacs_code: 'accountingUacsCode',
  accounting_debit: 'accountingDebit',
  accounting_credit: 'accountingCredit',
  section_c_name: 'sectionCName',
  section_c_position: 'sectionCPosition',
  section_c_date: 'sectionCDate',
  approved_by_name: 'approvedByName',
  approved_by_position: 'approvedByPosition',
  approved_by_date: 'approvedByDate',
  check_ada_no: 'checkAdaNo',
  bank_name_account: 'bankNameAccount',
  receipt_signature_name: 'receiptSignatureName',
  receipt_date: 'receiptDate',
  official_receipt_no: 'officialReceiptNo',
  jev_no: 'jevNo',
  received_at: 'receivedAt',
  received_remarks: 'receivedRemarks',
  released_at: 'releasedAt',
  released_remarks: 'releasedRemarks',
  check_received_at: 'checkReceivedAt',
  check_released_at: 'checkReleasedAt',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
};

const CAMEL_TO_COLUMN = Object.fromEntries(
  Object.entries(COLUMN_TO_CAMEL).map(([col, camel]) => [camel, col]),
);

// DECIMAL columns arrive from mysql2 as strings; the API exposes numbers.
const NUMERIC_CAMEL = new Set(['grossAmount', 'lessTax', 'netAmount', 'accountingDebit', 'accountingCredit']);

// DATE/DATETIME-ish fields: empty string becomes NULL (strict SQL rejects '').
const DATE_CAMEL = new Set([
  'date',
  'certifiedByDate',
  'sectionCDate',
  'approvedByDate',
  'receiptDate',
  'receivedAt',
  'releasedAt',
  'checkReceivedAt',
  'checkReleasedAt',
]);

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Quote identifiers that collide with reserved words (`date`). */
function qi(column) {
  return column === 'date' ? '`date`' : column;
}

/** DB row (snake_case) -> API voucher (camelCase). */
function toVoucher(row) {
  const out = {};
  for (const [column, camel] of Object.entries(COLUMN_TO_CAMEL)) {
    let value = row[column];
    if (NUMERIC_CAMEL.has(camel)) value = toNumber(value, 0);
    out[camel] = value === undefined ? null : value;
  }
  return out;
}

/**
 * API body (camelCase) -> { column: value } for INSERT/UPDATE.
 * Unknown keys and `id` are ignored; only provided fields are included.
 */
function toColumns(body) {
  const cols = {};
  for (const [camel, value] of Object.entries(body || {})) {
    const column = CAMEL_TO_COLUMN[camel];
    if (!column || column === 'id' || value === undefined) continue;
    if (DATE_CAMEL.has(camel)) {
      cols[column] = String(value).trim() === '' ? null : value;
    } else if (NUMERIC_CAMEL.has(camel)) {
      cols[column] = toNumber(value, 0);
    } else {
      cols[column] = value;
    }
  }
  return cols;
}

module.exports = { COLUMN_TO_CAMEL, CAMEL_TO_COLUMN, NUMERIC_CAMEL, qi, toNumber, toVoucher, toColumns };
