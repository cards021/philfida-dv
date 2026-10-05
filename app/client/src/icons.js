// Inline SVG icons (no emoji anywhere in the UI).
const P = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  search:
    '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.8-3.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  filter:
    '<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  pencil:
    '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 013 3L8 18.5 4 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  trash:
    '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m3 0l-.8 12.2a1 1 0 01-1 .8H7.8a1 1 0 01-1-.8L6 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  qrcode:
    '<rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13h3v3h-3zM18 13v3M13 18h3M18 18v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  scan: '<path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M4 12h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  download:
    '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  printer:
    '<path d="M7 8V4h10v4M7 16H4v-6h16v6h-3M7 14h10v6H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  logout:
    '<path d="M14 4H6v16h8M10 12h11m0 0l-3.5-3.5M21 12L17.5 15.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  user: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  chevL: '<path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  chevR: '<path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  alert:
    '<path d="M12 4L2.5 20h19L12 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="currentColor"/>',
  file: '<path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  inbox:
    '<path d="M4 13l2.5-8h11L20 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 13h5l1 2h4l1-2h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1v-9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
};

export function icon(name, cls = "") {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || ""}</svg>`;
}

export const LOGO_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.2 6.7.5-5.1 4.4 1.6 6.5L12 15.9l-5.8 3.7 1.6-6.5-5.1-4.4 6.7-.5z" fill="#fff" opacity="0.92"/></svg>`;
