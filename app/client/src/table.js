import { icon } from "./icons.js";
import { esc, peso, fmtDate, statusPill } from "./ui.js";

/** Next workflow stage for a voucher, or null when complete. */
export function nextStage(v) {
  if (!v.receivedAt) return { key: "receive", label: "Mark Received", icon: "inbox" };
  if (!v.releasedAt) return { key: "release", label: "Mark Released", icon: "send" };
  if (!v.checkReceivedAt) return { key: "check-receive", label: "Check Received", icon: "cash" };
  if (!v.checkReleasedAt) return { key: "check-release", label: "Check Released", icon: "check" };
  return null;
}

function actionButtons(v, isAdmin) {
  const stage = nextStage(v);
  const id = v.id;
  let html = `<button class="icon-btn" data-act="view" data-id="${id}" title="View details" aria-label="View voucher details">${icon("eye")}</button>`;
  html += `<button class="icon-btn" data-act="qr" data-id="${id}" title="Show QR code" aria-label="Show QR code">${icon("qrcode")}</button>`;
  html += `<button class="icon-btn" data-act="edit" data-id="${id}" title="Edit voucher" aria-label="Edit voucher">${icon("pencil")}</button>`;
  if (stage) {
    html += `<button class="stage-btn" data-act="stage" data-stage="${stage.key}" data-id="${id}" title="${esc(stage.label)}">${icon(stage.icon)}<span>${esc(stage.label)}</span></button>`;
  }
  if (isAdmin) {
    html += `<button class="icon-btn danger" data-act="delete" data-id="${id}" title="Delete voucher" aria-label="Delete voucher">${icon("trash")}</button>`;
  }
  return html;
}

function rowHtml(v, isAdmin, search) {
  const hl = (s) => {
    let out = esc(s);
    if (search) {
      const q = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
    }
    return out;
  };
  return `<tr data-id="${v.id}">
    <td class="sticky-col"><span class="cell-main">${hl(v.dvNo || "(No DV No.)")}</span></td>
    <td style="white-space:nowrap">${esc(fmtDate(v.date))}</td>
    <td>${hl(v.payee)}</td>
    <td style="max-width:260px"><span class="cell-sub">${hl(v.particulars)}</span></td>
    <td class="num">${esc(peso(v.grossAmount))}</td>
    <td class="num">${esc(peso(v.lessTax))}</td>
    <td class="num"><strong>${esc(peso(v.netAmount))}</strong></td>
    <td style="white-space:nowrap">${esc(fmtDate(v.receivedAt))}</td>
    <td style="white-space:nowrap">${esc(fmtDate(v.releasedAt))}</td>
    <td>${statusPill(v.status)}</td>
    <td><div class="row-actions">${actionButtons(v, isAdmin)}</div></td>
  </tr>`;
}

export function renderTable(vouchers, isAdmin, search) {
  const tbody = document.getElementById("voucherBody");
  if (!vouchers.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">${icon("file")}<p><strong>No vouchers found.</strong></p><p>Try adjusting your filters, or create a new voucher.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = vouchers.map((v) => rowHtml(v, isAdmin, search)).join("");
}

export function renderPagination(total, page, limit) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const info = document.getElementById("pageInfo");
  const prev = document.getElementById("prevPage");
  const next = document.getElementById("nextPage");
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  info.textContent = total === 0 ? "No records" : `Showing ${start}–${end} of ${total}`;
  prev.disabled = page <= 1;
  next.disabled = page >= pages;
  document.getElementById("pageNum").textContent = `Page ${page} of ${pages}`;
}
