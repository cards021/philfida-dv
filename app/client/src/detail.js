import { icon } from "./icons.js";
import { esc, peso, fmtDate, fmtDateTime, statusPill, statusLabel, openDrawer, closeDrawer } from "./ui.js";
import { nextStage } from "./table.js";
import { doStageAction, doDelete } from "./workflow.js";
import { showQrModal } from "./qr.js";
import { postExcel } from "./voucherForm.js";
import { printVoucher } from "./printDv.js";

function stageRow(label, at, remarks, done) {
  return `<div class="stage ${done ? "done" : ""}">
    <span class="stage-dot">${icon(done ? "check" : "clock")}</span>
    <div class="stage-body">
      <strong>${esc(label)}</strong>
      <div class="meta">${done ? esc(fmtDateTime(at)) : "Not yet recorded"}${remarks ? ` · ${esc(remarks)}` : ""}</div>
    </div>
  </div>`;
}

export function openDetail(v, isAdmin, callbacks) {
  const stage = nextStage(v);
  document.getElementById("drawerTitle").textContent = v.dvNo ? `DV ${v.dvNo}` : "Voucher Detail";
  document.getElementById("drawerSub").innerHTML = `${statusPill(v.status)} <span style="margin-left:8px">${esc(v.payee || "")}</span>`;

  const row = (k, val) => `<div><dt>${esc(k)}</dt><dd>${val}</dd></div>`;
  const txt = (val) => (val ? esc(val) : '<span style="color:var(--muted)">—</span>');

  document.getElementById("drawerBody").innerHTML = `
    <h3 class="section-title">Voucher</h3>
    <dl class="dl">
      ${row("DV No.", txt(v.dvNo))}
      ${row("Date", esc(fmtDate(v.date)))}
      ${row("Payee", txt(v.payee))}
      ${row("Particulars", txt(v.particulars))}
      ${row("Fund Cluster", txt(v.fundCluster))}
      ${row("Mode of Payment", txt(v.modeOfPayment) + (v.othersSpecify ? ` (${esc(v.othersSpecify)})` : ""))}
      ${row("TIN / Employee No.", txt(v.tinOrEmployeeNo))}
      ${row("ORS/BURS No.", txt(v.orsBursNo))}
      ${row("Address", txt(v.address))}
      ${row("Responsibility Center", txt(v.responsibilityCenter))}
      ${row("MFO/PAP", txt(v.mfoPap))}
      ${row("Amount in Words", txt(v.amountInWords))}
      ${row("Created By", txt(v.createdBy))}
    </dl>

    <h3 class="section-title">Amounts</h3>
    <dl class="dl">
      ${row("Gross Amount", esc(peso(v.grossAmount)))}
      ${row("Less Tax", esc(peso(v.lessTax)))}
      ${row("Net Amount", `<strong>${esc(peso(v.netAmount))}</strong>`)}
    </dl>

    <h3 class="section-title">Certification</h3>
    <dl class="dl">
      ${row("Certified By", txt(v.certifiedByName))}
      ${row("Designation", txt(v.certifiedByDesignation))}
      ${row("Date", esc(fmtDate(v.certifiedByDate)))}
    </dl>

    <h3 class="section-title">Accounting</h3>
    <dl class="dl">
      ${row("Account Title", txt(v.accountingAccountTitle))}
      ${row("UACS Code", txt(v.accountingUacsCode))}
      ${row("Debit", esc(peso(v.accountingDebit)))}
      ${row("Credit", esc(peso(v.accountingCredit)))}
      ${row("JEV No.", txt(v.jevNo))}
    </dl>

    <h3 class="section-title">Approval</h3>
    <dl class="dl">
      ${row("Section C — Name", txt(v.sectionCName))}
      ${row("Section C — Position", txt(v.sectionCPosition))}
      ${row("Section C — Date", esc(fmtDate(v.sectionCDate)))}
      ${row("Approved By", txt(v.approvedByName))}
      ${row("Position", txt(v.approvedByPosition))}
      ${row("Date", esc(fmtDate(v.approvedByDate)))}
    </dl>

    <h3 class="section-title">Check & Receipt</h3>
    <dl class="dl">
      ${row("Check / ADA No.", txt(v.checkAdaNo))}
      ${row("Bank & Account", txt(v.bankNameAccount))}
      ${row("Received By", txt(v.receiptSignatureName))}
      ${row("Receipt Date", esc(fmtDate(v.receiptDate)))}
      ${row("OR No.", txt(v.officialReceiptNo))}
    </dl>

    <h3 class="section-title">Workflow</h3>
    <div class="stages">
      ${stageRow("Received", v.receivedAt, v.receivedRemarks, !!v.receivedAt)}
      ${stageRow("Released", v.releasedAt, v.releasedRemarks, !!v.releasedAt)}
      ${stageRow("Check Received", v.checkReceivedAt, null, !!v.checkReceivedAt)}
      ${stageRow("Check Released", v.checkReleasedAt, null, !!v.checkReleasedAt)}
    </div>`;

  const foot = document.getElementById("drawerFoot");
  foot.innerHTML = "";
  const mk = (label, ic, cls, fn) => {
    const b = document.createElement("button");
    b.className = `btn ${cls}`;
    b.innerHTML = `${icon(ic)}<span>${esc(label)}</span>`;
    b.onclick = fn;
    foot.appendChild(b);
  };
  if (stage) mk(stage.label, stage.icon, "btn-primary", () => doStageAction(stage.key, v.id, callbacks.onChanged));
  mk("QR Code", "qrcode", "btn-outline", () => showQrModal(v));
  mk("Export Excel", "download", "btn-outline", () => postExcel(v));
  mk("Print / PDF", "printer", "btn-outline", () => printVoucher(v));
  mk("Edit", "pencil", "btn-outline", () => { closeDrawer(); callbacks.onEdit(v); });
  if (isAdmin) mk("Delete", "trash", "btn-danger", () => doDelete(v.id, v.dvNo, () => { closeDrawer(); callbacks.onChanged(); }));

  openDrawer();
}
