// Create-DV / New-Voucher forms, DV sheet HTML, PDF + Excel export.
import { state } from './state.js';
import { API, appConfig } from './config.js';
import { esc, formatDate, toast } from './utils.js';
import { postJSON } from './api.js';
import { QRCode, getQrBaseUrl, voucherScanUrl, renderQrReachabilityHint } from './qr.js';
import { openModal, closeModal, showQR, viewVoucher } from './modals.js';
import { insertVoucherRow, refreshStats } from './table.js';

/* global html2pdf */

export function calcNet() {
    const gross = parseFloat(document.getElementById('newGrossAmount').value) || 0;
    const lessTax = parseFloat(document.getElementById('newLessTax').value) || 0;
    const net = gross - lessTax;
    document.getElementById('newNetAmount').value = net.toFixed(2);
}

export function calcDVNet() {
    const gross = parseFloat(document.getElementById('dvGrossAmount').value) || 0;
    const lessTax = parseFloat(document.getElementById('dvLessTax').value) || 0;
    const net = gross - lessTax;
    document.getElementById('dvNetAmount').value = net.toFixed(2);
    document.getElementById('dvAmountDue').value = net.toFixed(2);
    updateDVQR();
}

export function buildQuickRegisterUrl() {
    const params = new URLSearchParams({
        register: '1',
        dv_no: document.getElementById('dvNo').value.trim(),
        payee: document.getElementById('dvPayee').value.trim(),
        particulars: document.getElementById('dvParticulars').value.trim(),
        gross_amount: document.getElementById('dvGrossAmount').value || '0',
        less_tax: document.getElementById('dvLessTax').value || '0',
        net_amount: document.getElementById('dvNetAmount').value || '0'
    });
    return getQrBaseUrl() + '?' + params.toString();
}

export function updateDVQR() {
    clearTimeout(state.dvQRDebounce);
    state.dvQRDebounce = setTimeout(() => {
        const c = document.getElementById('dvHeaderQR');
        if (!c) return;
        renderQrReachabilityHint('dvHeaderQRHint');
        const payee = document.getElementById('dvPayee').value.trim();
        c.innerHTML = '';
        if (!payee) {
            c.innerHTML = '<div style="font-size:6.5pt; color:#999; text-align:center; line-height:1.3;">Fill in Payee to generate QR</div>';
            return;
        }
        new QRCode(c, { text: buildQuickRegisterUrl(), width: 76, height: 76, colorDark: '#0a4d36', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }, 250);
}

export async function openCreateDV() {
    // Reset every field on the DV form to a blank slate.
    const textFields = [
        'dvFundCluster','dvNo','dvOthersSpecify','dvPayee','dvTinEmployeeNo','dvOrsBursNo','dvAddress',
        'dvParticulars','dvResponsibilityCenter','dvMfoPap','dvGrossAmount','dvLessTax',
        'dvCertifiedName','dvCertifiedDesignation','dvAccountTitle','dvUacsCode','dvDebit','dvCredit',
        'dvSectionCName','dvSectionCPosition','dvApprovedName','dvApprovedPosition',
        'dvJevNo','dvCheckAdaNo','dvBankNameAccount','dvReceiptSignatureName','dvOfficialReceiptNo'
    ];
    textFields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('dvNetAmount').value = '0.00';
    document.getElementById('dvAmountDue').value = '0.00';
    document.querySelectorAll('input[name="dvModePayment"]').forEach(r => r.checked = false);
    ['dvChkCash','dvChkDebitAccount','dvChkSupportingDocs'].forEach(id => { document.getElementById(id).checked = false; });

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dvDate').value = today;
    document.getElementById('dvSectionCDate').value = '';
    document.getElementById('dvApprovedDate').value = '';
    document.getElementById('dvReceiptDate').value = '';

    try {
        const res = await fetch(`${API}?action=next_dv_no`);
        const r = await res.json();
        if (r.dv_no) document.getElementById('dvNo').value = r.dv_no;
    } catch (e) { /* DV No. can still be filled manually if this fails */ }

    updateDVQR();
    openModal('createDVModal');
    // Wait a frame so the modal is actually laid out before measuring it.
    requestAnimationFrame(() => requestAnimationFrame(fitCreateDVToA4));
}

// The editable Create DV sheet is shown at its true, un-shrunk size (210mm
// wide, at least one A4 page tall via the .dv-a4-frame min-height) so the
// form and its text stay legible while filling it in. It's no longer
// squeezed down to force it onto exactly one page — that squeeze is only
// applied later, separately, when actually generating the PDF/print output
// (see fitPdfContentToPage() and exportPDF()), where fitting one physical
// page genuinely matters and the text no longer needs to stay editable-size.
export function fitCreateDVToA4() {
    const sheet = document.getElementById('dvPaperSheet');
    if (!sheet) return;
    sheet.style.transform = 'none';
}


export function getCreateDVFormData() {
    const modePayment = document.querySelector('input[name="dvModePayment"]:checked');

    return {
        dv_no: document.getElementById('dvNo').value.trim(),
        payee: document.getElementById('dvPayee').value.trim(),
        particulars: document.getElementById('dvParticulars').value.trim(),
        gross_amount: parseFloat(document.getElementById('dvGrossAmount').value) || 0,
        less_tax: parseFloat(document.getElementById('dvLessTax').value) || 0,
        net_amount: parseFloat(document.getElementById('dvNetAmount').value) || 0,
        created_by: 'Clerk',
        date: document.getElementById('dvDate').value,
        fund_cluster: document.getElementById('dvFundCluster').value.trim(),
        mode_of_payment: modePayment ? modePayment.value : '',
        others_specify: document.getElementById('dvOthersSpecify').value.trim(),
        tin_employee_no: document.getElementById('dvTinEmployeeNo').value.trim(),
        ors_burs_no: document.getElementById('dvOrsBursNo').value.trim(),
        address: document.getElementById('dvAddress').value.trim(),
        responsibility_center: document.getElementById('dvResponsibilityCenter').value.trim(),
        mfo_pap: document.getElementById('dvMfoPap').value.trim(),
        certified_by_name: document.getElementById('dvCertifiedName').value.trim(),
        certified_by_designation: document.getElementById('dvCertifiedDesignation').value.trim(),
        certified_by_date: '',
        accounting_account_title: document.getElementById('dvAccountTitle').value.trim(),
        accounting_uacs_code: document.getElementById('dvUacsCode').value.trim(),
        accounting_debit: parseFloat(document.getElementById('dvDebit').value) || 0,
        accounting_credit: parseFloat(document.getElementById('dvCredit').value) || 0,
        section_c_name: document.getElementById('dvSectionCName').value.trim(),
        section_c_position: document.getElementById('dvSectionCPosition').value.trim(),
        section_c_date: document.getElementById('dvSectionCDate').value,
        approved_by_name: document.getElementById('dvApprovedName').value.trim(),
        approved_by_position: document.getElementById('dvApprovedPosition').value.trim(),
        approved_by_date: document.getElementById('dvApprovedDate').value,
        check_ada_no: document.getElementById('dvCheckAdaNo').value.trim(),
        bank_name_account: document.getElementById('dvBankNameAccount').value.trim(),
        receipt_signature_name: document.getElementById('dvReceiptSignatureName').value.trim(),
        receipt_date: document.getElementById('dvReceiptDate').value,
        official_receipt_no: document.getElementById('dvOfficialReceiptNo').value.trim(),
        jev_no: document.getElementById('dvJevNo').value.trim()
        // Receiving, Processing, and Issuance of Check are intentionally left
        // unset on creation — they're stamped later via the Actions buttons
        // on the table, so a new voucher always starts out as "Pending".
    };
}

export function exportCreateDVExcel() {
    const data = getCreateDVFormData();
    if (!data.payee) {
        toast('Payee is required before exporting.', 'error');
        return;
    }
    // A browser only shows a file-save prompt for a real form submission or
    // navigation — not for a fetch() response — so this builds a hidden
    // form with the same data and submits it to export_dv_excel.php.
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/export-dv-excel';
    form.style.display = 'none';
    Object.entries(data).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value ?? '';
        form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    form.remove();
    toast('Preparing your Excel file...', 'success');
}

export function exportCreateDVPDF() {
    const data = getCreateDVFormData();
    if (!data.payee) {
        toast('Payee is required before exporting.', 'error');
        return;
    }
    state.currentVoucher = data;
    previewDV(data);
}

export async function submitCreateDV() {
    const btn = document.getElementById('dvSaveBtn');
    const data = getCreateDVFormData();
    const payeeEl = document.getElementById('dvPayee');
    payeeEl.classList.remove('field-invalid');

    if (!data.payee) {
        payeeEl.classList.add('field-invalid');
        toast('Payee is required.', 'error');
        payeeEl.focus();
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const r = await postJSON('create', data);
        if (r.success) {
            closeModal('createDVModal');
            if (data.dv_no) showQR(data.dv_no);
            // Skip the full-list reload — we already have every field this
            // row needs, so just drop it straight into the table.
            insertVoucherRow({
                ...data, id: Number(r.id),
                received_at: null, released_at: null,
                received_remarks: '', released_remarks: '',
                check_received_at: null, check_released_at: null,
            });
            refreshStats();
            toast('Disbursement Voucher saved successfully', 'success');
        } else {
            toast(r.error || 'Failed to save voucher.', 'error');
        }
    } catch (e) {
        toast('Failed to save voucher.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save';
    }
}

export async function openNewVoucher() {
    const fields = ['newPayee','newParticulars','newGrossAmount','newLessTax'];
    fields.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    document.getElementById('newNetAmount').value = '0.00';
    ['newDvNo', 'newPayee'].forEach(id => document.getElementById(id).classList.remove('field-invalid'));

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('newDate').value = today;
    // Receiving, Processing, and Issuance of Check are no longer set here —
    // a new voucher starts as Pending and moves through those stages via
    // the Actions buttons on the table.

    document.getElementById('newDvNo').value = '';
    try {
        const res = await fetch(`${API}?action=next_dv_no`);
        const r = await res.json();
        if (r.dv_no) {
            document.getElementById('newDvNo').value = r.dv_no;
        }
    } catch (e) { /* DV No. can still be filled manually if this fails */ }

    openModal('newVoucherModal');
}

export async function saveVoucher() {
    const dvNoEl = document.getElementById('newDvNo');
    const payeeEl = document.getElementById('newPayee');
    [dvNoEl, payeeEl].forEach(el => el.classList.remove('field-invalid'));

    const dv_no = dvNoEl.value.trim();
    const payee = payeeEl.value.trim();
    const invalid = [];
    if (!dv_no) invalid.push(dvNoEl);
    if (!payee) invalid.push(payeeEl);
    if (invalid.length) {
        invalid.forEach(el => el.classList.add('field-invalid'));
        toast('DV No. and Payee are required.', 'error');
        invalid[0].focus();
        return;
    }

    const data = {
        dv_no, payee,
        particulars: document.getElementById('newParticulars').value.trim(),
        gross_amount: parseFloat(document.getElementById('newGrossAmount').value) || 0,
        less_tax: parseFloat(document.getElementById('newLessTax').value) || 0,
        net_amount: parseFloat(document.getElementById('newNetAmount').value) || 0,
        created_by: 'Clerk',
        date: document.getElementById('newDate').value
        // Receiving, Processing, and Issuance of Check are intentionally left
        // unset on creation — they're stamped later via the Actions buttons
        // on the table (Mark Received / Mark Released / etc.), so a new
        // voucher always starts out as "Pending".
    };

    const btn = document.getElementById('saveVoucherBtn');
    const originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const r = await postJSON('create', data);
        if (r.success) {
            closeModal('newVoucherModal');
            // Skip the network-heavy "reload the whole list" round trip —
            // we already have every field we need to show this row right now.
            insertVoucherRow({
                ...data, id: Number(r.id),
                received_at: null, released_at: null,
                received_remarks: '', released_remarks: '',
                check_received_at: null, check_released_at: null,
            });
            refreshStats();
            toast('Voucher saved successfully', 'success');
        } else {
            toast(r.error || 'Failed to save voucher.', 'error');
        }
    } catch (e) {
        toast('Failed to save voucher.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
    }
}

export function previewDV(v) {
    document.getElementById('pdfPreviewContent').innerHTML = buildDVHtml(v);
    const qrCorner = document.getElementById('pdfQrCorner');
    if (qrCorner && v.dv_no) {
        const isSaved = !!v.id;
        const qrUrl = isSaved ? voucherScanUrl(v.dv_no) : buildQuickRegisterUrlFromVoucher(v);
        new QRCode(qrCorner, { text: qrUrl, width: 58, height: 58, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
    }
    openModal('pdfPreviewModal');
}

export function buildQuickRegisterUrlFromVoucher(v) {
    const params = new URLSearchParams({
        register: '1',
        dv_no: v.dv_no || '',
        payee: v.payee || '',
        particulars: v.particulars || '',
        gross_amount: v.gross_amount || '0',
        less_tax: v.less_tax || '0',
        net_amount: v.net_amount || '0'
    });
    return getQrBaseUrl() + '?' + params.toString();
}

export function buildDVHtml(v) {
    return `
    <div class="dv-page-frame"><div style="width: 210mm; padding: 0.25in 0.39in 0.2in 0.27in; font-family: 'Times New Roman', 'Tinos', Times, serif; font-size: 10pt; background: white; position: relative;" id="pdfContent">
<table class="dv-grid" style="width:193.236mm; border-collapse:collapse; table-layout:fixed; font-family:'Times New Roman','Tinos',Times,serif;">
<colgroup>
<col style="width:4.640mm">
<col style="width:4.162mm">
<col style="width:3.784mm">
<col style="width:2.018mm">
<col style="width:2.775mm">
<col style="width:3.153mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:6.713mm">
<col style="width:3.406mm">
<col style="width:3.153mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:8.451mm">
<col style="width:4.541mm">
<col style="width:3.153mm">
<col style="width:8.451mm">
<col style="width:3.784mm">
<col style="width:4.162mm">
<col style="width:3.153mm">
<col style="width:8.451mm">
<col style="width:4.036mm">
<col style="width:3.153mm">
<col style="width:4.289mm">
<col style="width:2.397mm">
</colgroup>
<tr style="height:10.5pt;">
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden" colspan="6"></td>
</tr>
<tr style="height:2.25pt;">
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:27.0pt;">
<td style="border-top:2px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:9.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="3" colspan="27"><div style="position:relative; text-align:center; line-height:1.25;"><img src="${appConfig.logos.daPhilfida}" alt="" style="position:absolute; left:2px; top:0; width:42px; height:auto;"><div style="font-weight:bold;">PHILIPPINE FIBER INDUSTRY DEVELOPMENT AUTHORITY</div><div>Rosvenil Subdivision, B. Aquino Avenue, Apitong Road, Tacloban City</div><div>Email: <span style="color:#0070C0; text-decoration:underline;">rotacloban@philfida.da.gov.ph</span> Website: <span style="color:#0070C0; text-decoration:underline;">www.philfida.da.gov.ph</span></div><div>Telephone Number: (053) 888-2428</div><img src="${appConfig.logos.socotec}" alt="" style="position:absolute; right:2px; top:0; width:34px; height:auto;"></div></td>
<td style="border-top:2px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6">Fund Cluster : </td>
</tr>
<tr style="height:15.0pt;">
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:11.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6">${esc(v.fund_cluster)}</td>
</tr>
<tr style="height:15.0pt;">
<td style="border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6">Date : ${v.date ? formatDate(v.date) : "________"}</td>
</tr>
<tr style="height:15.0pt;">
<td style="border-bottom:2px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:14.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="27"><div style="display:flex; align-items:center; justify-content:center; gap:10px;"><span>DISBURSEMENT&nbsp; VOUCHER</span><div id="pdfQrCorner" style="width:40px; height:40px;"></div></div></td>
<td style="border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6">DV No. : ${esc(v.dv_no) || "________"}</td>
</tr>
<tr style="height:6.0pt;">
<td style="border-bottom:2px solid #000;border-right:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6"></td>
</tr>
<tr style="height:9.75pt;">
<td style="border-top:2px solid #000;border-bottom:2px solid #000;border-left:2px solid #000;font-size:8.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 2px;overflow:visible;white-space:nowrap" rowspan="3" colspan="6">Mode of Payment</td>
<td style="border-top:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="26"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-right:2px solid #000;padding:2px 6px;overflow:hidden" colspan="27">
<div style="display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:nowrap;">
<span style="display:inline-flex;align-items:center;gap:3px;font-size:10.5pt;white-space:nowrap;"><span style="display:inline-block;width:9px;height:9px;border:1px solid #000;text-align:center;line-height:8px;font-size:7.5pt;margin-right:4px;">${v.mode_of_payment === "MDS Check" ? "&#10003;" : ""}</span>MDS Check</span>
<span style="display:inline-flex;align-items:center;gap:3px;font-size:10.5pt;white-space:nowrap;"><span style="display:inline-block;width:9px;height:9px;border:1px solid #000;text-align:center;line-height:8px;font-size:7.5pt;margin-right:4px;">${v.mode_of_payment === "Commercial Check" ? "&#10003;" : ""}</span>Commercial Check</span>
<span style="display:inline-flex;align-items:center;gap:3px;font-size:10.5pt;white-space:nowrap;"><span style="display:inline-block;width:9px;height:9px;border:1px solid #000;text-align:center;line-height:8px;font-size:7.5pt;margin-right:4px;">${v.mode_of_payment === "ADA" ? "&#10003;" : ""}</span>ADA</span>
<span style="display:inline-flex;align-items:center;gap:3px;font-size:10.5pt;white-space:nowrap;"><span style="display:inline-block;width:9px;height:9px;border:1px solid #000;text-align:center;line-height:8px;font-size:7.5pt;margin-right:4px;">${v.mode_of_payment === "Others" ? "&#10003;" : ""}</span>Others (Please specify)</span>
</div>
</td>
</tr>
<tr style="height:14.25pt;">
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="4"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:top;padding:1px 3px;overflow:hidden">${esc(v.others_specify)}</td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:15.0pt;">
<td style="border-top:2px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:8.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap" rowspan="2" colspan="3">Payee</td>
<td style="border-top:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:11.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="14">${esc(v.payee)}</td>
<td style="border-top:2px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="9">TIN/Employee No.:</td>
<td style="border-top:2px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6">ORS/BURS No.: </td>
</tr>
<tr style="height:10.5pt;">
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="9">${esc(v.tin_employee_no)}</td>
<td style="border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6">${esc(v.ors_burs_no)}</td>
</tr>
<tr style="height:12.0pt;">
<td style="border-top:1px solid #000;border-bottom:2px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:8.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 2px;overflow:hidden;white-space:nowrap" rowspan="2" colspan="4">Address</td>
<td style="border-top:1px solid #000;border-bottom:2px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:11.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="29">${esc(v.address)}</td>
</tr>
<tr style="height:12.0pt;">
</tr>
<tr style="height:28.25pt;">
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="20">Particulars</td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="4">Responsibility Center</td>
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:9.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="3">MFO/PAP</td>
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6">Amount</td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="17"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">${esc(v.responsibility_center)}</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">${esc(v.mfo_pap)}</td>
<td style="border-top:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6">${v.gross_amount ? Number(v.gross_amount).toFixed(2) : ""}</td>
</tr>
<tr style="height:18.0pt;">
<td style="border-left:2px solid #000;border-right:1px solid #000;font-size:11.0pt;text-align:left;vertical-align:top;padding:1px 3px;overflow:hidden" rowspan="8" colspan="20">${esc(v.particulars)}</td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:11.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">Php</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="4">${v.net_amount ? Number(v.net_amount).toFixed(2) : ""}</td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:11.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:11.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;border-right:2px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"> </td>
<td style="border-left:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:11.0pt;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="6"></td>
</tr>
<tr style="height:16.5pt;">
<td style="border-left:2px solid #000;font-size:12.0pt;font-weight:bold;text-align:right;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="17">Amount Due . . .</td>
<td style="border-bottom:2px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">  </td>
<td style="border-bottom:2px solid #000;border-right:1px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-left:1px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-right:1px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-left:1px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-right:1px solid #000;font-size:12.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-bottom:3px double #000;border-left:1px solid #000;font-size:12.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">P</td>
<td style="border-top:1px solid #000;border-bottom:3px double #000;border-right:2px solid #000;font-size:12.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="5">${v.net_amount ? Number(v.net_amount).toFixed(2) : "0.00"}</td>
</tr>
<tr style="height:17.5pt;">
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap">A.</td>
<td style="border-top:2px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="32"> Certified:  Expenses/Cash Advance necessary,  lawful and  incurred under my direct supervision.</td>
</tr>
<tr style="height:9.0pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">  </td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:30.0pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:0.5px solid #000;font-size:11.0pt;font-weight:bold;text-align:center;vertical-align:bottom;padding:1px 3px 0px 3px;overflow:hidden" colspan="16">${esc(v.certified_by_name)}${v.certified_by_designation ? ", " + esc(v.certified_by_designation) : ""}</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:11.5pt;">
<td style="border-left:2px solid #000;font-size:8.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden" colspan="31"></td>
<td style="border-right:2px solid #000;font-size:8.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:10.5pt;">
<td style="border-left:2px solid #000;font-size:8.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="font-size:8.0pt;font-style:italic;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="31"> Printed Name and Signature of Supervisor</td>
<td style="border-right:2px solid #000;font-size:8.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:6.0pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden" colspan="13"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:19.0pt;">
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap">B.</td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap"> Accounting Entry:</td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-right:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:15.75pt;">
<td style="border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="18">Account Title</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="5">UACS Code</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="5">Debit</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="5">Credit</td>
</tr>
<tr style="height:6.0pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:15.75pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden">${esc(v.accounting_account_title)}</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden">${esc(v.accounting_uacs_code)}</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden">${v.accounting_debit ? Number(v.accounting_debit).toFixed(2) : ""}</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden">${v.accounting_credit ? Number(v.accounting_credit).toFixed(2) : ""}</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:15.75pt;">
<td style="border-bottom:2px solid #000;border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:2px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:16.0pt;">
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap">C.</td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap">Certified:</td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap">D.</td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="11">Approved for Payment</td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:6.5pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-left:2px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:11.25pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">${v.dvChkCash ? "&#10003;" : ""}</td>
<td style="font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap;"> Cash available</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="7" colspan="15"></td>
</tr>
<tr style="height:4.5pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="7"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:11.25pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">${v.dvChkDebitAccount ? "&#10003;" : ""}</td>
<td style="font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap;"> Subject to Authority to Debit Account (when applicable)</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:7.5pt;">
<td style="border-left:2px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="18"></td>
</tr>
<tr style="height:11.25pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden">${v.dvChkSupportingDocs ? "&#10003;" : ""}</td>
<td style="font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap;" colspan="2"> Supporting documents complete and amount claimed </td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:11.25pt;">
<td style="border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap;">proper</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:6.0pt;">
<td style="border-bottom:1px solid #000;border-left:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:15.0pt;">
<td style="border-bottom:1px solid #000;border-left:2px solid #000;font-size:8.0pt;text-align:center;vertical-align:middle;padding:1px 2px;overflow:hidden;white-space:nowrap" rowspan="2" colspan="4">Signature</td>
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="14"></td>
<td style="border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:8.0pt;text-align:center;vertical-align:middle;padding:1px 2px;overflow:hidden;white-space:nowrap" rowspan="2" colspan="4">Signature</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="11"></td>
</tr>
<tr style="height:14.0pt;">
</tr>
<tr style="height:15.0pt;">
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="4">Printed Name</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:11.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="14">${esc(v.section_c_name)}</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="4">Printed Name</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:11.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="11">${esc(v.approved_by_name)}</td>
</tr>
<tr style="height:14.0pt;">
</tr>
<tr style="height:15.65pt;">
<td style="border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="4">Position</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:9.0pt;font-style:italic;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="14">${esc(v.section_c_position)}</td>
<td style="border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="4">Position</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:9.0pt;font-style:italic;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="11">${esc(v.approved_by_position)}</td>
</tr>
<tr style="height:9.0pt;">
<td style="border-top:1px solid #000;border-bottom:2px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="4">Date</td>
<td style="border-bottom:2px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="14">${v.section_c_date ? formatDate(v.section_c_date) : "" }</td>
<td style="border-top:1px solid #000;border-bottom:2px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="4">Date</td>
<td style="border-top:1px solid #000;border-bottom:2px solid #000;border-left:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="11">${v.approved_by_date ? formatDate(v.approved_by_date) : "" }</td>
</tr>
<tr style="height:15.75pt;">
</tr>
<tr style="height:13.5pt;">
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap">E. </td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap">Receipt of Payment </td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-bottom:1px solid #000;border-right:1px solid #000;font-size:10.0pt;font-weight:bold;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:visible;white-space:nowrap">JEV  No.</td>
<td style="border-top:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="3">${esc(v.jev_no)}</td>
</tr>
<tr style="height:12.75pt;">
<td style="border-bottom:1px solid #000;border-left:2px solid #000;font-size:10.0pt;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="3">Check/   ADA No. :</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="9">${esc(v.check_ada_no)}</td>
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="5">Date : ${v.receipt_date ? formatDate(v.receipt_date) : "________"}</td>
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="9">Bank Name &amp; Account Number: ${esc(v.bank_name_account) || "________"}</td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:14.0pt;">
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-bottom:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
</tr>
<tr style="height:12.75pt;">
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:8.0pt;text-align:center;vertical-align:middle;padding:1px 2px;overflow:hidden;white-space:nowrap" rowspan="2" colspan="4">Signature :</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="9">${esc(v.receipt_signature_name)}</td>
<td style="border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="5">Date :</td>
<td style="border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:9.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="9">Printed Name: </td>
<td style="border-top:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden"></td>
<td style="border-top:1px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="4"></td>
</tr>
<tr style="height:14.25pt;">
<td style="border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000;font-size:9.0pt;font-weight:bold;text-align:center;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="9"></td>
<td style="border-bottom:2px solid #000;border-right:2px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" rowspan="2" colspan="6"></td>
</tr>
<tr style="height:15.65pt;">
<td style="border-top:1px solid #000;border-bottom:2px solid #000;border-left:2px solid #000;border-right:1px solid #000;font-size:10.0pt;text-align:left;vertical-align:middle;padding:1px 3px;overflow:hidden" colspan="27">Official Receipt No. &amp; Date/Other Documents ${esc(v.official_receipt_no) || "________"}</td>
</tr>
<tr style="height:13.0pt;">
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="padding:1px 3px;overflow:hidden"></td>
<td style="border-top:2px solid #000;font-size:8.0pt;font-style:italic;text-align:right;vertical-align:top;padding:1px 3px;overflow:hidden" colspan="6">Revised: 08/2022</td>
</tr>
</table>
    </div></div>`;
}

export async function exportPDF() {
    const element = document.getElementById('pdfContent');
    const dvNo = state.currentVoucher?.dv_no || 'Voucher_' + (state.currentVoucher?.id || 'DV');
    const filename = `Disbursement_Voucher_${dvNo}.pdf`;
    const btn = document.querySelector('#pdfPreviewModal button[onclick="exportPDF()"]');
    const originalBtnHtml = btn ? btn.innerHTML : null;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...'; }

    // Wait for the DV sheet's fonts (Times New Roman / Tinos fallback) to
    // actually finish loading before capturing anything below. Google Fonts
    // loads with font-display:swap, so right after previewDV() renders the
    // sheet the browser may still be showing it in a temporary fallback
    // font, which would get captured into the PDF instead of the real one.
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) { /* proceed with best effort */ }
    }
    // Undo any leftover shrink from a previous export/Ctrl+P pass so the
    // sheet is always captured at its true, natural size.
    element.style.zoom = 1;
    element.style.transform = 'none';

    try {
        // IMPORTANT: this deliberately does NOT end with the usual
        // `html2pdf().set(...).from(element).save()` one-liner. That default
        // path always fails to keep a voucher taller than one A4 page on a
        // single page, no matter how much the content is shrunk beforehand,
        // because of how html2pdf.js's own toPdf() step works (confirmed
        // against its source): it takes the captured canvas, stretches it to
        // fill the FULL page width, and slices whatever doesn't fit onto
        // extra pages based on `canvas.height / (canvas.width * pageAspect)`.
        // That's a function of the canvas's aspect ratio only — shrinking
        // the source element with CSS `zoom` (or `transform: scale`) shrinks
        // width and height by the same factor, which leaves the aspect
        // ratio — and therefore the page count — exactly unchanged. That's
        // why the voucher kept spilling onto (or getting cut off across) a
        // second page even though a shrink was already being applied.
        //
        // Fix: let html2pdf.js capture the canvas and create the jsPDF
        // document as usual (so we don't have to worry about whether
        // html2canvas/jsPDF are separately available as globals), but once
        // it's done, discard whatever it drew and place the ORIGINAL,
        // full-height canvas onto a single page ourselves — scaled down
        // (preserving its proportions) to fit within BOTH the page's
        // printable width and height at once, like an image "contain" fit.
        // That guarantees one page no matter how tall the voucher is.
        await html2pdf()
            .set({
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: [8.2677, 11.6929], orientation: 'portrait' }, // A4: 210mm x 297mm
                margin: 0,
                // Disabled: with mode:'avoid-all' this plugin inserts blank
                // spacer <div>s into the (off-screen) cloned copy of the
                // sheet to keep elements from crossing the page-height
                // boundary it assumes will be sliced at — a boundary that
                // no longer matters once we discard the sliced output below.
                // Left enabled, those spacers would just add pointless gaps
                // to the captured canvas.
                pagebreak: { mode: [] }
            })
            .from(element)
            .toCanvas()
            .toPdf()
            .then(function () {
                const pdf = this.prop.pdf;
                const canvas = this.prop.canvas;

                // Drop every page but the first — this is the sliced,
                // multi-page output described above, about to be replaced.
                while (pdf.internal.getNumberOfPages() > 1) {
                    pdf.deletePage(pdf.internal.getNumberOfPages());
                }
                pdf.setPage(1);
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pageWidth, pageHeight, 'F');

                // Margin: Excel's "Narrow" preset (jsPDF unit is 'in') —
                // Top/Bottom 0.75in, Left/Right 0.25in. (Narrow's 0.3in
                // Header/Footer offset is moot here: no separate header or
                // footer text is drawn, so the Top/Bottom margin alone
                // already keeps that space clear.)
                const marginTop = 0.75;
                const marginBottom = 0.75;
                const marginLeft = 0.25;
                const marginRight = 0.25;
                const areaWidth = pageWidth - marginLeft - marginRight;
                const areaHeight = pageHeight - marginTop - marginBottom;

                // Stretch the canvas to exactly fill the margin box on both
                // axes (matches the native-print fit below), so the voucher
                // fills the page edge-to-edge instead of leaving blank space
                // on whichever side the canvas's own aspect ratio didn't
                // need as much shrinking.
                const imgWidth = areaWidth;
                const imgHeight = areaHeight;
                const x = marginLeft;
                const y = marginTop;
                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);

                pdf.save(filename);
            });
    } catch (e) {
        console.error('PDF export failed:', e);
        toast('Could not generate the PDF. Please try again.', 'error');
    } finally {
        element.style.zoom = 1;
        element.style.transform = 'none';
        if (btn) { btn.disabled = false; btn.innerHTML = originalBtnHtml; }
    }
}


// Native Ctrl+P fallback: scales #pdfContent's width and height
// independently (via transform, not a single uniform zoom) so it fills the
// print margin box exactly on both axes, right before the print dialog
// captures the page. #pdfContent is position:absolute, so this is purely
// visual and doesn't affect surrounding layout; undone afterward so the
// on-screen Preview isn't affected.
export function fitPdfContentToPage() {
    const el = document.getElementById('pdfContent');
    if (!el) return;
    el.style.zoom = 1;
    el.style.transform = 'none';
    const PX_PER_MM = 96 / 25.4;
    // Printable area: A4 minus the same Excel "Narrow" margin set on #pdfContent above (0.25in=6.35mm left/right, 0.75in=19.05mm top/bottom).
    const printableWidthPx = (210 - 6.35 - 6.35) * PX_PER_MM;
    const printableHeightPx = (297 - 19.05 - 19.05) * PX_PER_MM;
    const scaleX = printableWidthPx / el.scrollWidth;
    const scaleY = printableHeightPx / el.scrollHeight;
    el.style.transformOrigin = 'top left';
    el.style.transform = `scale(${scaleX}, ${scaleY})`;
}

export function promptQrBaseUrl() {
    const current = localStorage.getItem('dvQrBaseUrl') || '';
    const value = window.prompt(
        "Enter the address your phone should use to reach this dashboard,\n" +
        "e.g. http://192.168.1.20/dashboard.php\n\n" +
        "Find your computer's LAN IP with \"ipconfig\" (Windows) or \"ifconfig\"/\"ip addr\" (Mac/Linux) " +
        "— use the IPv4 address on the same WiFi/network as your phone.\n\n" +
        "Leave this blank to go back to using this browser's own address.",
        current
    );
    if (value === null) return; // cancelled
    if (value.trim()) {
        localStorage.setItem('dvQrBaseUrl', value.trim());
    } else {
        localStorage.removeItem('dvQrBaseUrl');
    }
    updateDVQR();
    if (state.currentVoucher && state.currentVoucher.dv_no && document.getElementById('qrModal') && !document.getElementById('qrModal').classList.contains('hidden')) {
        showQR(state.currentVoucher.dv_no);
    }
}

