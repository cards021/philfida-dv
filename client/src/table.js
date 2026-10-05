// Voucher table: loading, filtering, sorting, stats cards, row patching.
import { state, MONTH_NAMES, STATUS_LABELS } from './state.js';
import { API, appConfig } from './config.js';
import { esc, escJsAttr, escapeRegExp, formatDate } from './utils.js';


export async function loadVouchers() {
    const search = document.getElementById('searchInput').value.trim();
    const year = document.getElementById('yearFilter').value;
    const month = document.getElementById('monthFilter').value;
    const p = new URLSearchParams({ action: 'list' });
    if (search) p.append('search', search);
    if (year) p.append('year', year);
    if (month) p.append('month', month);

    const tbody = document.getElementById('voucherTable');

    try {
        const res = await fetch(`${API}?` + p.toString());
        const vouchers = await res.json();

        if (vouchers.error) {
            tbody.innerHTML = `<tr><td colspan="13" class="px-6 py-12 text-center text-red-500">
                <i class="fas fa-exclamation-circle text-4xl mb-3"></i>
                <div>${vouchers.error}</div>
            </td></tr>`;
            return;
        }

        state.lastVouchers = vouchers;
        state.lastSearchTerm = search;
        renderVoucherTable();
    } catch(e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="13" class="px-6 py-12 text-center text-red-500">
            <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
            <div>${e.message}</div>
        </td></tr>`;
    }
}

/* Matches a voucher against a stat-card filter key, mirroring the SQL used for $initialStats */
export function matchesStatusFilter(v, key) {
    switch (key) {
        case 'receiving': return !!v.received_at;
        case 'releasing': return !!v.released_at;
        case 'check': return !!v.check_received_at && !v.check_released_at;
        case 'completed': return !!v.released_at;
        default: return true; // 'total' or no filter
    }
}

// Briefly dips the table's opacity before re-rendering, so switching a
// filter/sort feels like one smooth transition rather than an instant swap.
export function swapTable(renderFn) {
    const container = document.querySelector('.table-container');
    if (!container) { renderFn(); return; }
    container.classList.add('is-swapping');
    requestAnimationFrame(() => {
        setTimeout(() => {
            renderFn();
            requestAnimationFrame(() => container.classList.remove('is-swapping'));
        }, 110);
    });
}

export function setStatusFilter(key, el) {
    const wasActive = el.classList.contains('is-active');
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('is-active'));
    state.activeStatusFilter = wasActive ? null : key;
    if (!wasActive) el.classList.add('is-active');
    swapTable(renderVoucherTable);
}

export function clearStatusFilter() {
    state.activeStatusFilter = null;
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('is-active'));
    swapTable(renderVoucherTable);
}

export function sortBy(col) {
    state.sortDir = (state.sortColumn === col) ? -state.sortDir : 1;
    state.sortColumn = col;
    document.querySelectorAll('#recordsTable thead th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === col) th.classList.add(state.sortDir === 1 ? 'sort-asc' : 'sort-desc');
    });
    swapTable(renderVoucherTable);
}

export function renderRowHtml(v, search) {
    let status = 'Pending', statusIcon = 'fa-clock', statusClass = 'status-pending';
    if (v.released_at) { status = 'Completed'; statusIcon = 'fa-check-circle'; statusClass = 'status-completed'; }
    else if (v.received_at) { status = 'Awaiting Releasing'; statusIcon = 'fa-paper-plane'; statusClass = 'status-received'; }

    // Escape first, then highlight — so highlighting never reopens the
    // door to HTML/script injection via a crafted DV No./Payee/Particulars.
    let dn = esc(v.dv_no || '(No DV No.)'), py = esc(v.payee), pt = esc(v.particulars);
    if (search) {
        const r = new RegExp(`(${escapeRegExp(esc(search))})`, 'gi');
        dn = dn.replace(r, '<mark class="bg-emerald-100 text-emerald-800 px-1 rounded">$1</mark>');
        py = py.replace(r, '<mark class="bg-emerald-100 text-emerald-800 px-1 rounded">$1</mark>');
        pt = pt.replace(r, '<mark class="bg-emerald-100 text-emerald-800 px-1 rounded">$1</mark>');
    }

    // Three-stage action buttons: Received -> Released -> Issuance of Check
    const receivedBtn = v.received_at
        ? `<button class="action-btn is-done" title="Received on ${formatDate(v.received_at)}" style="color: #16a34a;"><i class="fas fa-inbox"></i></button>`
        : `<button onclick="promptRemarks(${v.id}, 'received')" class="action-btn" title="Mark as Received" style="color: #b45309;"><i class="fas fa-inbox"></i></button>`;

    const releasedBtn = !v.received_at
        ? `<button class="action-btn is-disabled" title="Mark as Received first"><i class="fas fa-paper-plane"></i></button>`
        : v.released_at
        ? `<button class="action-btn is-done" title="Released on ${formatDate(v.released_at)}" style="color: #16a34a;"><i class="fas fa-paper-plane"></i></button>`
        : `<button onclick="promptRemarks(${v.id}, 'released')" class="action-btn" title="Mark as Released" style="color: #0369a1;"><i class="fas fa-paper-plane"></i></button>`;

    const checkBtn = !v.released_at
        ? `<button class="action-btn is-disabled" title="Available after Released"><i class="fas fa-money-check-alt"></i></button>`
        : !v.check_received_at
        ? `<button onclick="markCheckReceived(${v.id}, true)" class="action-btn" title="Issuance of Check — Mark Received" style="color: #c2410c;"><i class="fas fa-money-check-alt"></i></button>`
        : !v.check_released_at
        ? `<button onclick="markCheckReleased(${v.id}, true)" class="action-btn" title="Issuance of Check — Mark Released" style="color: #6d28d9;"><i class="fas fa-money-check-alt"></i></button>`
        : `<button class="action-btn is-done" title="Check fully issued" style="color: #16a34a;"><i class="fas fa-money-check-alt"></i></button>`;

    return `<tr class="table-row" data-id="${v.id}" style="border-bottom: 1px solid var(--border-soft);">
        <td class="px-6 py-4 font-semibold font-poppins" style="cursor: pointer; color: var(--primary-dark);" onclick="viewVoucher(${v.id})" title="View full details">${dn}</td>
        <td class="px-6 py-4 text-sm" style="color: var(--ink-500);">${formatDate(v.date)}</td>
        <td class="px-6 py-4 font-medium" style="color: var(--ink-700);">${py}</td>
        <td class="px-6 py-4 max-w-xs truncate text-sm" style="color: var(--ink-500);">${pt}</td>
        <td class="px-6 py-4 text-right text-sm" style="color: var(--ink-500);">₱${(parseFloat(v.gross_amount)||0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td class="px-6 py-4 text-right text-sm" style="color: var(--ink-500);">₱${(parseFloat(v.less_tax)||0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td class="px-6 py-4 text-right font-bold font-poppins" style="color: var(--primary-dark);">₱${(parseFloat(v.net_amount)||0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td class="px-6 py-4 text-sm" style="color: var(--ink-500); white-space: nowrap;">${v.received_at ? formatDate(v.received_at) : '<span style="color: var(--ink-400);">—</span>'}</td>
        <td class="px-6 py-4 max-w-[160px] truncate text-sm" style="color: var(--ink-500);" title="${esc(v.received_remarks)}">${v.received_remarks ? esc(v.received_remarks) : '<span style="color: var(--ink-400);">—</span>'}</td>
        <td class="px-6 py-4 text-sm" style="color: var(--ink-500); white-space: nowrap;">${v.released_at ? formatDate(v.released_at) : '<span style="color: var(--ink-400);">—</span>'}</td>
        <td class="px-6 py-4 max-w-[160px] truncate text-sm" style="color: var(--ink-500);" title="${esc(v.released_remarks)}">${v.released_remarks ? esc(v.released_remarks) : '<span style="color: var(--ink-400);">—</span>'}</td>
        <td class="px-6 py-4">
            <span class="status-pill ${statusClass}">
                <i class="fas ${statusIcon}"></i>
                ${status}
            </span>
        </td>
        <td class="px-6 py-4 text-center">
            <div class="action-group">
                ${v.dv_no ? `<button onclick="showQR('${escJsAttr(v.dv_no)}')" class="action-btn" title="View QR" style="color: var(--primary);"><i class="fas fa-qrcode"></i></button>` : ''}
                ${receivedBtn}
                ${releasedBtn}
                ${checkBtn}
                ${appConfig.isAdmin ? `<button onclick="promptDelete(${v.id})" class="action-btn" title="Delete" style="color: #ef4444;"><i class="fas fa-trash"></i></button>` : ''}
            </div>
        </td>
    </tr>`;
}

export function renderVoucherTable() {
    const tbody = document.getElementById('voucherTable');
    const info = document.getElementById('resultsInfo');
    const clearBtn = document.getElementById('clearSearchBtn');
    const chipSlot = document.getElementById('filterChipSlot');
    const search = state.lastSearchTerm;
    const year = document.getElementById('yearFilter').value;
    const month = document.getElementById('monthFilter').value;

    chipSlot.innerHTML = state.activeStatusFilter
        ? `<span class="filter-chip"><i class="fas fa-filter" style="font-size:10px;"></i> ${STATUS_LABELS[state.activeStatusFilter] || state.activeStatusFilter}<button onclick="clearStatusFilter()" title="Clear filter"><i class="fas fa-times" style="font-size:9px;"></i></button></span>`
        : '';

    let vouchers = state.lastVouchers.filter(v => matchesStatusFilter(v, state.activeStatusFilter));

    if (state.sortColumn) {
        vouchers = vouchers.slice().sort((a, b) => {
            let av = a[state.sortColumn], bv = b[state.sortColumn];
            if (state.sortColumn === 'gross_amount' || state.sortColumn === 'net_amount') {
                return ((parseFloat(av) || 0) - (parseFloat(bv) || 0)) * state.sortDir;
            }
            if (state.sortColumn === 'date') {
                return ((av ? new Date(av).getTime() : 0) - (bv ? new Date(bv).getTime() : 0)) * state.sortDir;
            }
            av = (av || '').toString().toLowerCase();
            bv = (bv || '').toString().toLowerCase();
            if (av < bv) return -1 * state.sortDir;
            if (av > bv) return 1 * state.sortDir;
            return 0;
        });
    }

    if (!vouchers.length) {
        const monthName = month ? MONTH_NAMES[parseInt(month, 10) - 1] : '';
        const filterDesc = [search ? `"${search}"` : '', monthName, year ? `year ${year}` : '', state.activeStatusFilter ? STATUS_LABELS[state.activeStatusFilter] : ''].filter(Boolean).join(' in ');
        tbody.innerHTML = (search || year || month || state.activeStatusFilter)
            ? `<tr><td colspan="13" class="px-6 py-12 text-center text-slate-400">
                <i class="fas fa-search text-4xl mb-3"></i>
                <div>No vouchers found${filterDesc ? ' for ' + filterDesc : ''}</div>
               </td></tr>`
            : `<tr><td colspan="13" class="px-6 py-12 text-center text-slate-400">
                <i class="fas fa-inbox text-4xl mb-3"></i>
                <div>No vouchers yet. Click "New Voucher" to create one.</div>
               </td></tr>`;
        info.textContent = filterDesc ? `No results for ${filterDesc}` : 'No vouchers';
        clearBtn.classList.toggle('hidden', !search);
        return;
    }

    tbody.innerHTML = vouchers.map(v => renderRowHtml(v, search)).join('');

    const monthName = month ? MONTH_NAMES[parseInt(month, 10) - 1] : '';
    const periodDesc = [monthName, year].filter(Boolean).join(' ');
    const statusDesc = state.activeStatusFilter ? STATUS_LABELS[state.activeStatusFilter] : '';
    const parts = [];
    parts.push(search ? `Found ${vouchers.length} matching "${search}"` : `Showing ${vouchers.length} voucher${vouchers.length === 1 ? '' : 's'}`);
    if (periodDesc) parts.push(`from ${periodDesc}`);
    if (statusDesc) parts.push(`· ${statusDesc}`);
    info.textContent = parts.join(' ');
    clearBtn.classList.toggle('hidden', !search);
}

export async function refreshStats() {
    try {
        const res = await fetch(`${API}?action=stats`);
        const s = await res.json();
        if (s.error) return;
        setStatValue('statTotal', s.total);
        setStatValue('statReceiving', s.awaiting_receiving);
        setStatValue('statReleasing', s.awaiting_releasing);
        setStatValue('statCheckReleasing', s.awaiting_check_releasing);
        setStatValue('statCompleted', s.completed);
        animateCountUp();
    } catch (e) {
        // Stats are a nice-to-have overlay on top of the table; a failed
        // refresh shouldn't surface an error toast for something this minor.
    }
}

export function setStatValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('data-value', value);
}

export function matchesActiveListFilters(v) {
    const search = state.lastSearchTerm.trim().toLowerCase();
    const year = document.getElementById('yearFilter').value;
    const month = document.getElementById('monthFilter').value;
    if (search) {
        const hay = `${v.dv_no || ''} ${v.payee || ''} ${v.particulars || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
    }
    if (v.date && (year || month)) {
        const d = new Date(v.date);
        if (year && d.getFullYear() !== parseInt(year, 10)) return false;
        if (month && d.getMonth() + 1 !== parseInt(month, 10)) return false;
    }
    return true;
}

export function patchVoucherRow(id, changes) {
    const idx = state.lastVouchers.findIndex(v => v.id === id);
    if (idx === -1) return null;
    const previous = { ...lastVouchers[idx] };
    const updated = Object.assign(state.lastVouchers[idx], changes);

    // If a status filter is active and this voucher no longer belongs in the
    // current view (e.g. it just left "Awaiting Receiving"), drop it out with
    // the same fade used for filter/sort changes rather than patching a row
    // that's about to look out of place.
    if (state.activeStatusFilter && !matchesStatusFilter(updated, state.activeStatusFilter)) {
        swapTable(renderVoucherTable);
        return previous;
    }

    const row = document.querySelector(`#voucherTable tr[data-id="${id}"]`);
    if (row) {
        row.outerHTML = renderRowHtml(updated, state.lastSearchTerm);
        const fresh = document.querySelector(`#voucherTable tr[data-id="${id}"]`);
        if (fresh) fresh.classList.add('row-flash');
    } else {
        renderVoucherTable();
    }
    return previous;
}

export function insertVoucherRow(v) {
    state.lastVouchers.unshift(v);
    if (matchesActiveListFilters(v)) {
        swapTable(renderVoucherTable);
    }
}

export function handleSearch() {
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(loadVouchers, 300);
}

export function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').classList.add('hidden');
    const hint = document.getElementById('searchKbdHint');
    if (hint) hint.style.display = '';
    loadVouchers();
}

export function populateYearFilter() {
    const sel = document.getElementById('yearFilter');
    const currentYear = new Date().getFullYear();
    const startYear = 2025;
    const endYear = currentYear + 2; // a couple years ahead for future-dated vouchers
    for (let y = startYear; y <= endYear; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = false;
        sel.appendChild(opt);
    }
}

export function animateCountUp() {
    document.querySelectorAll('.count-up').forEach(el => {
        const target = parseInt(el.getAttribute('data-value'), 10) || 0;
        const duration = 900;
        const start = performance.now();
        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
            else el.textContent = target;
        }
        requestAnimationFrame(tick);
    });
}

export function spinRefresh(btn) {
    const icon = document.getElementById('refreshIcon');
    if (icon) {
        icon.style.transition = 'transform 0.5s ease';
        icon.style.transform = 'rotate(360deg)';
        setTimeout(() => { icon.style.transition = 'none'; icon.style.transform = 'rotate(0deg)'; }, 520);
    }
    loadVouchers();
    refreshStats(); // an explicit manual refresh should also true-up the KPI cards
}

