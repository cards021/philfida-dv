// Shared mutable dashboard state.
//
// ES module namespace bindings are read-only, so cross-module mutable state
// lives on this single object: modules import `state` and read/mutate its
// properties (e.g. `state.currentVoucher = v`).

export const state = {
    html5QrCode: null,      // Html5Qrcode instance while the scanner is open
    currentVoucher: null,   // voucher being viewed in the detail modal / PDF preview
    searchTimeout: null,    // debounce timer for the search box
    voucherToDelete: null,  // voucher id pending in the delete-confirm modal
    lastVouchers: [],       // last batch fetched from the server (already server-filtered by search/year/month)
    lastSearchTerm: '',
    activeStatusFilter: null, // 'total' | 'receiving' | 'releasing' | 'check' | 'completed' | null
    sortColumn: null,         // dv_no | date | payee | gross_amount | net_amount
    sortDir: 1,               // 1 = asc, -1 = desc
    remarksPending: null,   // { id, type } pending in the remarks modal
    dvQRDebounce: null,       // debounce timer for the Create-DV live QR
};

export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const STATUS_LABELS = { total: 'All Vouchers', receiving: 'Received', releasing: 'Released', check: 'Issuance of Check', completed: 'Completed' };

export const UNREACHABLE_QR_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
