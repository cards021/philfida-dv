import { esc, peso, fmtDate } from "./ui.js";

/**
 * Render an official-looking Disbursement Voucher into #print-root and
 * invoke the browser print dialog. The @media print stylesheet hides the
 * app and shows only this document (→ "Save as PDF" works too).
 */
export function printVoucher(v) {
  const root = document.getElementById("print-root");
  const row = (k, val, span = 1) =>
    `<td colspan="${span}"><strong>${esc(k)}</strong><br>${val ? esc(val) : "—"}</td>`;
  root.innerHTML = `
  <div class="dv-doc">
    <h1>DISBURSEMENT VOUCHER</h1>
    <p class="doc-sub">PhilFIDA · Disbursement Voucher Tracking System</p>
    <table>
      <tr>
        ${row("Fund Cluster", v.fundCluster)}
        ${row("Date", fmtDate(v.date))}
        ${row("DV No.", v.dvNo)}
      </tr>
      <tr>
        <td colspan="2"><strong>Payee</strong><br>${v.payee ? esc(v.payee) : "—"}</td>
        ${row("TIN / Employee No.", v.tinOrEmployeeNo)}
      </tr>
      <tr>
        ${row("ORS/BURS No.", v.orsBursNo)}
        ${row("Mode of Payment", v.modeOfPayment + (v.othersSpecify ? " — " + v.othersSpecify : ""), 2)}
      </tr>
      <tr>${row("Address", v.address, 3)}</tr>
      <tr>${row("Particulars", v.particulars, 3)}</tr>
      <tr>
        ${row("Responsibility Center", v.responsibilityCenter)}
        ${row("MFO/PAP", v.mfoPap)}
        ${row("Amount in Words", v.amountInWords)}
      </tr>
      <tr>
        <td><strong>Gross Amount</strong><br>${esc(peso(v.grossAmount))}</td>
        <td><strong>Less Tax</strong><br>${esc(peso(v.lessTax))}</td>
        <td><strong>Net Amount</strong><br>${esc(peso(v.netAmount))}</td>
      </tr>
      <tr>
        ${row("Check / ADA No.", v.checkAdaNo)}
        ${row("Bank Name & Account", v.bankNameAccount, 2)}
      </tr>
      <tr>
        ${row("Official Receipt No.", v.officialReceiptNo)}
        ${row("Receipt Date", fmtDate(v.receiptDate))}
        ${row("JEV No.", v.jevNo)}
      </tr>
    </table>
    <div class="sig-grid">
      <div class="sig"><strong>A. Certified</strong><br>Correctness of the above data<br>
        <div class="line">${esc(v.certifiedByName || "")}${v.certifiedByDesignation ? "<br>" + esc(v.certifiedByDesignation) : ""}${v.certifiedByDate ? "<br>" + esc(fmtDate(v.certifiedByDate)) : ""}</div>
      </div>
      <div class="sig"><strong>B. Accounting Entry</strong><br>${esc(v.accountingAccountTitle || "")}<br>UACS: ${esc(v.accountingUacsCode || "")}<br>Debit: ${esc(peso(v.accountingDebit))} · Credit: ${esc(peso(v.accountingCredit))}
        <div class="line">${esc(v.sectionCName || "")}${v.sectionCPosition ? "<br>" + esc(v.sectionCPosition) : ""}</div>
      </div>
      <div class="sig"><strong>C. Approved for Payment</strong>
        <div class="line">${esc(v.approvedByName || "")}${v.approvedByPosition ? "<br>" + esc(v.approvedByPosition) : ""}${v.approvedByDate ? "<br>" + esc(fmtDate(v.approvedByDate)) : ""}</div>
      </div>
      <div class="sig"><strong>D. Received Payment</strong><br>${esc(v.receiptSignatureName || "")}
        <div class="line">Signature over printed name / Date</div>
      </div>
    </div>
  </div>`;
  // Give the DOM a tick, then print.
  setTimeout(() => window.print(), 60);
}
