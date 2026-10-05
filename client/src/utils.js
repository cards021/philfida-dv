// Pure helpers: escaping, formatting, toasts. No dependencies.
export function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }


// Escapes any user-entered value before it goes into an innerHTML template.
// Vouchers (dv_no, payee, particulars, remarks, etc.) are free-text fields —
// without this, someone entering e.g. `<img src=x onerror=...>` as a Payee
// would get their script executed in the browser of every other person
// (including Admins) who views the table, voucher detail, or PDF preview.
export function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// For values interpolated inside an inline onclick="fn('...')" JS string
// literal (e.g. a DV No. used as showQR('${dv_no}')). esc() alone isn't
// enough here: the browser decodes HTML entities while parsing the
// attribute BEFORE handing the text to the JS parser, so an HTML-escaped
// quote (&#39;) still comes back as a literal ' in time to break out of
// the string. Escape backslashes/quotes for JS first, then make the result
// safe as HTML attribute text.
export function escJsAttr(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function formatDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}); }

/* ===== Modern UI helpers: toasts, count-up, micro-interactions ===== */
export function toast(message, type = 'info') {
    const stack = document.getElementById('toastStack');
    if (!stack) { return; }
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 260);
    }, 3400);
}

