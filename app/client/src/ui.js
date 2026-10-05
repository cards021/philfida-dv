import { icon } from "./icons.js";

/** Escape any user-controlled string before injecting into innerHTML. */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a number as Philippine pesos. */
export function peso(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return (
    "₱" +
    v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** Format an ISO date/datetime nicely ("Jan 5, 2026"). Empty → em dash. */
export function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return esc(d);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format an ISO datetime with time. */
export function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return esc(d);
  return (
    dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    ", " +
    dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

const STATUS_META = {
  pending: { label: "Pending", cls: "st-pending" },
  received: { label: "Awaiting Release", cls: "st-received" },
  released: { label: "Released", cls: "st-released" },
  in_check: { label: "In Check Process", cls: "st-in_check" },
  completed: { label: "Completed", cls: "st-completed" },
};

export function statusPill(status) {
  const m = STATUS_META[status] || { label: esc(status), cls: "st-pending" };
  return `<span class="status-pill ${m.cls}"><span class="dot"></span>${esc(m.label)}</span>`;
}

export function statusLabel(status) {
  return (STATUS_META[status] || {}).label || status;
}

/* ---------------- Toasts ---------------- */
export function toast(msg, type = "info") {
  const host = document.getElementById("toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === "error" ? "alert" : type === "success" ? "check" : "clock")}<span>${esc(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  }, 3400);
}

/* ---------------- Modals ---------------- */
let openCount = 0;

export function openModal(id) {
  const bd = document.getElementById(id);
  if (!bd) return;
  bd.classList.add("open");
  document.body.style.overflow = "hidden";
  openCount++;
  const dlg = bd.querySelector(".modal");
  if (dlg) {
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
  }
  const f = bd.querySelector("input, select, textarea, button:not(.modal-close)");
  if (f) setTimeout(() => f.focus(), 60);
}

export function closeModal(id) {
  const bd = document.getElementById(id);
  if (!bd || !bd.classList.contains("open")) return;
  bd.classList.remove("open");
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.style.overflow = "";
}

// Clicking the backdrop (not the dialog) closes; Escape closes topmost.
document.addEventListener("click", (e) => {
  const bd = e.target.closest(".modal-backdrop.open, .drawer-backdrop.open");
  if (bd && e.target === bd) {
    bd.classList.remove("open");
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.style.overflow = "";
    if (bd.id === "drawerBackdrop") closeDrawer();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const open = [...document.querySelectorAll(".modal-backdrop.open, .drawer-backdrop.open")].pop();
  if (open) {
    open.classList.remove("open");
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.style.overflow = "";
    if (open.id === "drawerBackdrop") closeDrawer();
  }
});

export function openDrawer() {
  document.getElementById("drawerBackdrop")?.classList.add("open");
  document.getElementById("drawer")?.classList.add("open");
  document.body.style.overflow = "hidden";
  openCount++;
}
export function closeDrawer() {
  document.getElementById("drawerBackdrop")?.classList.remove("open");
  document.getElementById("drawer")?.classList.remove("open");
}

/** Promise-based confirm dialog. Resolves true on confirm, false on cancel. */
export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const bd = document.getElementById("confirmModal");
    bd.querySelector("[data-confirm-title]").textContent = title;
    bd.querySelector("[data-confirm-msg]").textContent = message;
    const okBtn = bd.querySelector("[data-confirm-ok]");
    okBtn.textContent = confirmLabel;
    okBtn.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
    const done = (v) => {
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      closeModal("confirmModal");
      resolve(v);
    };
    const cancelBtn = bd.querySelector("[data-confirm-cancel]");
    okBtn.onclick = () => done(true);
    cancelBtn.onclick = () => done(false);
    openModal("confirmModal");
  });
}
