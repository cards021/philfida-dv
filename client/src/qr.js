// QR code generation (npm `qrcode`) and scanning (npm `html5-qrcode`).
import QRCodeLib from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { UNREACHABLE_QR_HOSTS } from './state.js';

export { Html5Qrcode };

/**
 * Drop-in replacement for the old qrcodejs `new QRCode(el, opts)` global.
 * Renders via the `qrcode` npm package onto a canvas appended to the
 * container. Call sites are unchanged from the original dashboard.js.
 */
export class QRCode {
    static CorrectLevel = { L: 'L', M: 'M', Q: 'Q', H: 'H' };
    constructor(container, opts) {
        // Guard against out-of-order async renders (e.g. the debounced
        // Create-DV QR): only the latest render for a container wins.
        const seq = (Number(container.dataset.qrSeq) || 0) + 1;
        container.dataset.qrSeq = String(seq);
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        QRCodeLib.toCanvas(canvas, opts.text, {
            width: opts.width,
            margin: 1,
            color: { dark: opts.colorDark, light: opts.colorLight },
            errorCorrectionLevel: opts.correctLevel,
        }).then(() => {
            if (container.dataset.qrSeq === String(seq)) container.appendChild(canvas);
        }).catch(() => { /* leave the container empty on failure */ });
    }
}


export function getQrBaseUrl() {
    const saved = localStorage.getItem('dvQrBaseUrl');
    if (saved) return saved.replace(/\/+$/, '');
    return window.location.origin + window.location.pathname;
}

export function isQrHostUnreachable() {
    return UNREACHABLE_QR_HOSTS.includes(window.location.hostname) && !localStorage.getItem('dvQrBaseUrl');
}

export function renderQrReachabilityHint(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (isQrHostUnreachable()) {
        el.innerHTML = `<span style="color:#b91c1c;"><i class="fas fa-triangle-exclamation"></i> Won't scan from a phone (page opened via ${window.location.hostname}).</span>
            <button type="button" onclick="promptQrBaseUrl()" style="color:#0f6b4a; font-weight:600; text-decoration:underline; background:none; border:none; cursor:pointer; padding:0; font-size:inherit;">Fix this</button>`;
        el.style.display = '';
    } else {
        el.innerHTML = '';
        el.style.display = 'none';
    }
}


export function voucherScanUrl(dv) {
    return getQrBaseUrl() + '?dv=' + encodeURIComponent(dv);
}

