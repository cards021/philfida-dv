// Modals: voucher detail, QR display, remarks, delete confirm, QR scanner.
import { state } from './state.js';
import { API, appConfig } from './config.js';
import { esc, escJsAttr, formatDate, toast } from './utils.js';
import { postJSON } from './api.js';
import { QRCode, Html5Qrcode, voucherScanUrl, renderQrReachabilityHint } from './qr.js';
import { insertVoucherRow, refreshStats, patchVoucherRow } from './table.js';

export function openModal(id) { document.getElementById(id).classList.remove('hidden'); }

export function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

export function showQR(dvNo) {
    document.getElementById('qrDvLabel').textContent = dvNo;
    const c = document.getElementById('qrDisplay'); c.innerHTML = '';
    new QRCode(c, { text: voucherScanUrl(dvNo), width: 220, height: 220, colorDark: '#065f46', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
    renderQrReachabilityHint('qrModalHint');
    openModal('qrModal');
}

export async function viewVoucher(identifier) {
    // Table rows pass the numeric id; QR scans / manual lookup pass the DV No.
    const isId = typeof identifier === 'number' || /^\d+$/.test(String(identifier));
    const param = isId ? ('id=' + encodeURIComponent(identifier)) : ('dv=' + encodeURIComponent(identifier));
    const res = await fetch(`${API}?action=get&` + param);
    const v = await res.json();
    if(v.error) { toast(v.error, 'error'); return; }
    state.currentVoucher = v;
    document.getElementById('detailTitle').textContent = v.dv_no || 'Voucher #' + v.id;
    document.getElementById('detailSubtitle').textContent = v.payee;

    let status = 'Pending', statusIcon = 'fa-clock', statusClass = 'status-pending';
    if(v.released_at){status='Completed';statusIcon='fa-check-circle';statusClass='status-completed';}
    else if(v.received_at){status='Awaiting Releasing';statusIcon='fa-paper-plane';statusClass='status-received';}

    // Issuance of Check step (only relevant once the voucher itself is released)
    let checkStepHtml = '';
    if (v.released_at && !v.check_received_at) {
        checkStepHtml = `<button onclick="markCheckReceived(${v.id})" class="btn w-full" style="background: #c2410c; color: white;">
            <i class="fas fa-money-check-alt"></i>
            Mark Check as Received
        </button>`;
    } else if (v.check_received_at && !v.check_released_at) {
        checkStepHtml = `<button onclick="markCheckReleased(${v.id})" class="btn w-full" style="background: #6d28d9; color: white;">
            <i class="fas fa-hand-holding-usd"></i>
            Mark Check as Released
        </button>`;
    } else if (v.check_released_at) {
        checkStepHtml = `<div class="text-sm text-center text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-xl py-2">
            <i class="fas fa-check-double"></i> Check fully released
        </div>`;
    }

    document.getElementById('detailBody').innerHTML = `
    <div class="flex justify-between items-center">
        <span class="text-sm font-semibold text-slate-500">Status</span>
        <span class="status-pill ${statusClass}">
            <i class="fas ${statusIcon}"></i>
            ${status}
        </span>
    </div>
    <div class="grid grid-cols-2 gap-4">
        <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div class="text-xs text-slate-500 font-semibold mb-1">Date</div>
            <div class="font-bold text-slate-800">${formatDate(v.date)}</div>
        </div>
        <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div class="text-xs text-slate-500 font-semibold mb-1">Fund Cluster</div>
            <div class="font-bold text-slate-800">${esc(v.fund_cluster) || '—'}</div>
        </div>
        <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div class="text-xs text-slate-500 font-semibold mb-1">Payee</div>
            <div class="font-bold text-slate-800">${esc(v.payee)}</div>
        </div>
        <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div class="text-xs text-slate-500 font-semibold mb-1">TIN/Employee No.</div>
            <div class="font-bold text-slate-800">${esc(v.tin_employee_no) || '—'}</div>
        </div>
    </div>
    <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div class="text-xs text-slate-500 font-semibold mb-1">Particulars</div>
        <div class="text-slate-800">${esc(v.particulars)}</div>
    </div>
    <div class="rounded-xl p-4 border" style="background: var(--accent-soft); border-color: #a7d8cf;">
        <div class="text-xs text-slate-500 font-semibold mb-1">Amount</div>
        <div class="text-3xl font-bold" style="color: var(--primary-dark);">₱${(parseFloat(v.net_amount)||0).toFixed(2)}</div>
    </div>
    ${checkStepHtml ? `<div class="pt-1">${checkStepHtml}</div>` : ''}
    <div class="flex gap-2 pt-2">
        <button onclick="previewDV(currentVoucher)" class="btn btn-danger flex-1">
            <i class="fas fa-file-pdf"></i>
            Export PDF
        </button>
        ${v.dv_no ? `<button onclick="showQR('${escJsAttr(v.dv_no)}'); closeModal('detailModal');" class="btn btn-primary flex-1">
            <i class="fas fa-qrcode"></i>
            View QR
        </button>` : ''}
        ${appConfig.isAdmin ? `<button onclick="promptDelete(${v.id}); closeModal('detailModal');" class="btn btn-danger flex-1">
            <i class="fas fa-trash"></i>
            Delete
        </button>` : ''}
    </div>`;
    openModal('detailModal');
}


// Opens the Remarks modal for the Received/Released stage instead of marking
// the voucher immediately, so the remark is captured at the moment of action.
export function promptRemarks(id, type) {
    state.remarksPending = { id, type };

    const isReceived = type === 'received';
    document.getElementById('remarksModalTitle').textContent = isReceived ? 'Mark as Received' : 'Mark as Released';
    document.getElementById('remarksModalSubtitle').textContent = isReceived
        ? 'Add an optional remark for the Receiving stage'
        : 'Add an optional remark for the Releasing stage';
    document.getElementById('remarksModalIcon').style.background = isReceived ? '#b45309' : '#0369a1';
    document.getElementById('remarksModalIconGlyph').className = `fas ${isReceived ? 'fa-inbox' : 'fa-paper-plane'} text-white text-2xl`;
    document.getElementById('remarksInput').value = '';
    document.getElementById('remarksVoucherDvNo').textContent = 'Loading…';
    document.getElementById('remarksVoucherPayee').textContent = '';

    openModal('remarksModal');
    document.getElementById('remarksInput').focus();

    fetch(`${API}?action=get&id=` + encodeURIComponent(id))
        .then(res => res.json())
        .then(v => {
            if (v.error) return;
            document.getElementById('remarksVoucherDvNo').textContent = 'DV No: ' + (v.dv_no || 'N/A');
            document.getElementById('remarksVoucherPayee').textContent = 'Payee: ' + v.payee;
        })
        .catch(() => {});
}

export async function confirmRemarks() {
    if (!state.remarksPending) return;
    const { id, type } = state.remarksPending;
    const remarks = document.getElementById('remarksInput').value.trim();
    const action = type === 'received' ? 'mark_received' : 'mark_released';
    const field = type === 'received' ? 'received_at' : 'released_at';
    const remarksField = type === 'received' ? 'received_remarks' : 'released_remarks';

    // Optimistic: the row — and any button that depends on this stage, like
    // "Released" waiting on "Received" — updates the instant the user
    // confirms, instead of waiting on a round trip + a full table reload.
    const previous = patchVoucherRow(id, { [field]: new Date().toISOString(), [remarksField]: remarks });
    closeModal('remarksModal');
    state.remarksPending = null;

    try {
        const r = await postJSON(action, { id, remarks });
        if (r.success) {
            toast(type === 'received' ? 'Voucher marked as received' : 'Voucher marked as released', 'success');
            refreshStats();
        } else {
            if (previous) patchVoucherRow(id, previous);
            toast(r.error || 'Failed to update.', 'error');
        }
    } catch (e) {
        if (previous) patchVoucherRow(id, previous);
        toast('Failed to update.', 'error');
    }
}

export async function markCheckReceived(id, silent) {
    const previous = patchVoucherRow(id, { check_received_at: new Date().toISOString() });
    try {
        const r = await postJSON('mark_check_received', { id });
        if (r.success) {
            if (!silent) viewVoucher(id);
            toast('Marked check as received', 'success');
            refreshStats();
        } else {
            if (previous) patchVoucherRow(id, previous);
            toast(r.error || 'Failed to update.', 'error');
        }
    } catch (e) {
        if (previous) patchVoucherRow(id, previous);
        toast('Failed to update.', 'error');
    }
}

export async function markCheckReleased(id, silent) {
    const previous = patchVoucherRow(id, { check_released_at: new Date().toISOString() });
    try {
        const r = await postJSON('mark_check_released', { id });
        if (r.success) {
            if (!silent) viewVoucher(id);
            toast('Marked check as released', 'success');
            refreshStats();
        } else {
            if (previous) patchVoucherRow(id, previous);
            toast(r.error || 'Failed to update.', 'error');
        }
    } catch (e) {
        if (previous) patchVoucherRow(id, previous);
        toast('Failed to update.', 'error');
    }
}

// Works even when the voucher has no DV No. — identification is by id (primary key).
export function promptDelete(id) {
    state.voucherToDelete = id;
    fetch(`${API}?action=get&id=` + encodeURIComponent(id))
        .then(res => res.json())
        .then(v => {
            if(v.error) { toast(v.error, 'error'); return; }
            document.getElementById('deleteVoucherDvNo').textContent = 'DV No: ' + (v.dv_no || 'N/A');
            document.getElementById('deleteVoucherPayee').textContent = 'Payee: ' + v.payee;
            document.getElementById('deleteVoucherAmount').textContent = 'Amount: ₱' + (parseFloat(v.net_amount)||0).toFixed(2);
            closeModal('detailModal');
            openModal('deleteConfirmModal');
        });
}

export async function confirmDelete() {
    if (!state.voucherToDelete) {
        toast('No voucher selected for deletion', 'error');
        return;
    }
    const id = state.voucherToDelete;
    const idx = state.lastVouchers.findIndex(v => v.id === id);
    const removed = idx !== -1 ? state.lastVouchers[idx] : null;

    // Optimistic: the row disappears the moment the user confirms, rather
    // than waiting on the network before the table reflects the deletion.
    if (idx !== -1) { state.lastVouchers.splice(idx, 1); swapTable(renderVoucherTable); }
    closeModal('deleteConfirmModal');
    state.voucherToDelete = null;

    try {
        const r = await postJSON('delete', { id });
        if (r.success) {
            toast('Voucher deleted', 'success');
            refreshStats();
        } else {
            if (removed) { state.lastVouchers.splice(idx, 0, removed); swapTable(renderVoucherTable); }
            toast(r.error || 'Failed to delete voucher.', 'error');
        }
    } catch (e) {
        if (removed) { state.lastVouchers.splice(idx, 0, removed); swapTable(renderVoucherTable); }
        toast(e.message, 'error');
    }
}

export function openScanner() {
    openModal('scannerModal');
    setTimeout(startScanner, 300);
}

export function closeScanner() {
    if(state.html5QrCode && state.html5QrCode.isScanning) {
        state.html5QrCode.stop().then(() => state.html5QrCode.clear()).catch(() => {});
    }
    closeModal('scannerModal');
}

export function extractDvFromScan(text) {
    try {
        const url = new URL(text);
        const dv = url.searchParams.get('dv');
        if (dv) return dv;
    } catch (e) { /* not a URL — treat as a plain DV No. */ }
    return text;
}

export function isQuickRegisterUrl(text) {
    try {
        const url = new URL(text);
        return url.searchParams.get('register') === '1';
    } catch (e) { return false; }
}

export async function registerFromScannedUrl(text) {
    const p = new URL(text).searchParams;
    const dvNo = p.get('dv_no') || '';
    const data = {
        dv_no: dvNo,
        payee: p.get('payee') || '',
        particulars: p.get('particulars') || '',
        gross_amount: parseFloat(p.get('gross_amount')) || 0,
        less_tax: parseFloat(p.get('less_tax')) || 0,
        net_amount: parseFloat(p.get('net_amount')) || 0,
        created_by: 'Clerk',
        date: new Date().toISOString().split('T')[0] // stamp the scan moment, same as the server-side register=1 handler
    };
    try {
        const r = await postJSON('create', data);
        if (r.success) {
            toast(`Voucher ${dvNo || '#' + r.id} registered`, 'success');
            insertVoucherRow({
                ...data, id: Number(r.id),
                received_at: null, released_at: null,
                received_remarks: '', released_remarks: '',
                check_received_at: null, check_released_at: null,
            });
            refreshStats();
            viewVoucher(dvNo || r.id);
        } else {
            toast(r.error || 'Could not register this voucher.', 'error');
        }
    } catch (e) {
        toast('Could not register this voucher.', 'error');
    }
}

export function startScanner() {
    if(state.html5QrCode && state.html5QrCode.isScanning) return;
    state.html5QrCode = new Html5Qrcode("qr-reader");
    state.html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (t) => {
            closeScanner();
            if (isQuickRegisterUrl(t)) {
                registerFromScannedUrl(t);
            } else {
                viewVoucher(extractDvFromScan(t));
            }
        },
        () => {}
    ).catch(() => {
        document.getElementById('qr-reader').innerHTML = '<div class="p-6 text-center text-sm text-slate-500">Camera unavailable.</div>';
    });
}

export function lookupManual() {
    const dv = document.getElementById('manualDv').value.trim();
    if(!dv) { toast('Enter a DV No. to look up', 'error'); return; }
    closeScanner();
    viewVoucher(dv);
}

