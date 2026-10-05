import { api, nextNumber } from "./api.js";
import { esc, toast, openModal, closeModal } from "./ui.js";
import { icon } from "./icons.js";

const SECTIONS = [
  {
    title: "Voucher Information",
    fields: [
      { name: "dvNo", label: "DV No.", type: "text", extra: `<button type="button" class="btn btn-ghost" id="autoDvNo" title="Get next DV number">${icon("check")} Auto</button>` },
      { name: "date", label: "Date", type: "date" },
      { name: "payee", label: "Payee", type: "text", required: true, full: true },
      { name: "particulars", label: "Particulars", type: "textarea", full: true },
      { name: "fundCluster", label: "Fund Cluster", type: "text" },
      {
        name: "modeOfPayment", label: "Mode of Payment", type: "select",
        options: ["", "MDS Check", "Commercial Check", "ADA", "Others"],
      },
      { name: "othersSpecify", label: "Others (specify)", type: "text", hiddenUnlessOthers: true },
      { name: "tinOrEmployeeNo", label: "TIN / Employee No.", type: "text" },
      { name: "orsBursNo", label: "ORS/BURS No.", type: "text" },
      { name: "address", label: "Address", type: "text", full: true },
      { name: "responsibilityCenter", label: "Responsibility Center", type: "text" },
      { name: "mfoPap", label: "MFO/PAP", type: "text" },
      { name: "amountInWords", label: "Amount in Words", type: "text", full: true },
      { name: "createdBy", label: "Created By", type: "text" },
    ],
  },
  {
    title: "Amounts",
    fields: [
      { name: "grossAmount", label: "Gross Amount (₱)", type: "number", step: "0.01", min: "0" },
      { name: "lessTax", label: "Less Tax (₱)", type: "number", step: "0.01", min: "0" },
      { name: "netAmount", label: "Net Amount (₱)", type: "number", step: "0.01", min: "0", hint: "Auto-calculated as Gross − Tax; editable." },
    ],
  },
  {
    title: "Certification",
    fields: [
      { name: "certifiedByName", label: "Certified By (Name)", type: "text" },
      { name: "certifiedByDesignation", label: "Designation", type: "text" },
      { name: "certifiedByDate", label: "Date", type: "date" },
    ],
  },
  {
    title: "Accounting",
    fields: [
      { name: "accountingAccountTitle", label: "Account Title", type: "text", full: true },
      { name: "accountingUacsCode", label: "UACS Code", type: "text" },
      { name: "accountingDebit", label: "Debit (₱)", type: "number", step: "0.01", min: "0" },
      { name: "accountingCredit", label: "Credit (₱)", type: "number", step: "0.01", min: "0" },
      { name: "jevNo", label: "JEV No.", type: "text" },
    ],
  },
  {
    title: "Approval",
    fields: [
      { name: "sectionCName", label: "Section C — Name", type: "text" },
      { name: "sectionCPosition", label: "Section C — Position", type: "text" },
      { name: "sectionCDate", label: "Section C — Date", type: "date" },
      { name: "approvedByName", label: "Approved By (Name)", type: "text" },
      { name: "approvedByPosition", label: "Approved By (Position)", type: "text" },
      { name: "approvedByDate", label: "Approved Date", type: "date" },
    ],
  },
  {
    title: "Check & Receipt",
    fields: [
      { name: "checkAdaNo", label: "Check / ADA No.", type: "text" },
      { name: "bankNameAccount", label: "Bank Name & Account No.", type: "text", full: true },
      { name: "receiptSignatureName", label: "Received By (Signature Name)", type: "text" },
      { name: "receiptDate", label: "Receipt Date", type: "date" },
      { name: "officialReceiptNo", label: "Official Receipt No.", type: "text" },
    ],
  },
];

function fieldHtml(f, value) {
  const val = value ?? "";
  const req = f.required ? " required" : "";
  const cls = f.full ? "field full" : "field";
  const wrap = f.hiddenUnlessOthers ? ` data-others-wrap style="display:none"` : "";
  let input;
  if (f.type === "textarea") {
    input = `<textarea class="textarea" id="f_${f.name}" name="${f.name}"${req}>${esc(val)}</textarea>`;
  } else if (f.type === "select") {
    const opts = f.options.map((o) => `<option value="${esc(o)}"${String(val) === o ? " selected" : ""}>${esc(o || "— Select —")}</option>`).join("");
    input = `<select class="select" id="f_${f.name}" name="${f.name}"${req}>${opts}</select>`;
  } else {
    const attrs = [`type="${f.type}"`];
    if (f.step) attrs.push(`step="${f.step}"`);
    if (f.min) attrs.push(`min="${f.min}"`);
    input = `<input class="input" id="f_${f.name}" name="${f.name}" value="${esc(val)}" ${attrs.join(" ")}${req} />`;
  }
  return `<div class="${cls}"${wrap}>
    <label for="f_${f.name}">${esc(f.label)}${f.required ? ' <span aria-hidden="true" style="color:var(--danger)">*</span>' : ""}</label>
    <div style="display:flex;gap:8px;align-items:center">${input}${f.extra || ""}</div>
    ${f.hint ? `<p class="form-hint">${esc(f.hint)}</p>` : ""}
  </div>`;
}

function toFormValue(v) {
  // datetime/date from API → yyyy-mm-dd for <input type="date">
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return v ?? "";
}

export function openVoucherModal(voucher = null, onSaved) {
  const isEdit = !!voucher;
  document.getElementById("voucherModalTitle").textContent = isEdit ? "Edit Voucher" : "New Voucher";
  const body = document.getElementById("voucherFormBody");
  body.innerHTML = SECTIONS.map(
    (s) => `<h3 class="section-title">${esc(s.title)}</h3>
     <div class="form-grid">${s.fields.map((f) => fieldHtml(f, toFormValue(voucher?.[f.name]))).join("")}</div>`
  ).join("");

  const form = document.getElementById("voucherForm");
  const modeSel = form.elements.modeOfPayment;
  const othersWrap = form.querySelector("[data-others-wrap]");
  const syncOthers = () => {
    othersWrap.style.display = modeSel.value === "Others" ? "" : "none";
  };
  modeSel.addEventListener("change", syncOthers);
  syncOthers();

  // Net = Gross − Tax (live), still editable afterwards.
  const gross = form.elements.grossAmount;
  const tax = form.elements.lessTax;
  const net = form.elements.netAmount;
  const recalc = () => {
    net.value = ((parseFloat(gross.value) || 0) - (parseFloat(tax.value) || 0)).toFixed(2);
  };
  gross.addEventListener("input", recalc);
  tax.addEventListener("input", recalc);

  if (!isEdit) {
    document.getElementById("autoDvNo").onclick = async () => {
      try {
        const { dvNo } = await nextNumber();
        form.elements.dvNo.value = dvNo || "";
      } catch (e) {
        toast(e.message, "error");
      }
    };
    if (!form.elements.date.value) form.elements.date.value = new Date().toISOString().slice(0, 10);
  } else {
    // No auto-numbering when editing an existing voucher.
    document.getElementById("autoDvNo")?.remove();
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    for (const s of SECTIONS) {
      for (const f of s.fields) {
        let v = form.elements[f.name].value;
        if (f.type === "number") v = v === "" ? 0 : parseFloat(v);
        if (f.type === "date" && v === "") v = null;
        data[f.name] = v;
      }
    }
    if (!String(data.payee || "").trim()) {
      toast("Payee is required.", "error");
      form.elements.payee.focus();
      return;
    }
    const saveBtn = document.getElementById("voucherSaveBtn");
    saveBtn.disabled = true;
    try {
      const saved = isEdit
        ? await api(`/api/vouchers/${encodeURIComponent(voucher.id)}`, { method: "PATCH", body: data })
        : await api("/api/vouchers", { method: "POST", body: data });
      closeModal("voucherModal");
      toast(isEdit ? "Voucher updated." : "Voucher created.", "success");
      onSaved && onSaved(saved);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      saveBtn.disabled = false;
    }
  };

  document.getElementById("voucherExportBtn").onclick = () => exportFormToExcel(form);
  openModal("voucherModal");
}

/** Export whatever is currently in the form via a hidden form POST (file download). */
export function exportFormToExcel(form) {
  const data = {};
  for (const s of SECTIONS) {
    for (const f of s.fields) data[f.name] = form.elements[f.name].value;
  }
  postExcel(data);
}

/** POST fields to /api/export/excel through a hidden form + iframe so the
 *  browser shows a file-save prompt (fetch can't do that). */
export function postExcel(fields) {
  let iframe = document.getElementById("exportFrame");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "exportFrame";
    iframe.name = "exportFrame";
    iframe.className = "sr-only";
    document.body.appendChild(iframe);
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/export/excel";
  form.target = "exportFrame";
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = String(v);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
  toast("Preparing Excel file…", "info");
}
