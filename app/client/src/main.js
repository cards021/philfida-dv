import { getMe, logout, getCsrf, listVouchers, getStats } from "./api.js";
import { esc, toast, openModal, closeModal, statusLabel } from "./ui.js";
import { icon, LOGO_SVG } from "./icons.js";
import { renderTable, renderPagination } from "./table.js";
import { openVoucherModal } from "./voucherForm.js";
import { openDetail } from "./detail.js";
import { doStageAction, doDelete } from "./workflow.js";
import { showQrModal, openScanner, wireScannerButtons } from "./qr.js";

const LIMIT = 25;
const state = {
  user: null,
  isAdmin: false,
  filters: { search: "", year: "", month: "", status: "" },
  page: 1,
  limit: LIMIT,
  byId: new Map(),
  loading: false,
};

const $ = (id) => document.getElementById(id);

async function refresh() {
  if (state.loading) return;
  state.loading = true;
  try {
    const [list, stats] = await Promise.all([
      listVouchers({ ...state.filters, page: state.page, limit: state.limit }),
      getStats(),
    ]);
    state.byId.clear();
    for (const v of list.data) state.byId.set(v.id, v);
    renderTable(list.data, state.isAdmin, state.filters.search);
    renderPagination(list.total, list.page, list.limit);
    renderKpis(stats);
    syncFilterUi();
  } catch (e) {
    toast(e.message, "error");
  } finally {
    state.loading = false;
  }
}

const KPI_DEFS = [
  { key: "", label: "Total", stat: "total", cls: "k-total" },
  { key: "pending", label: "Pending", stat: "pending", cls: "k-pending" },
  { key: "received", label: "Received", stat: "received", cls: "k-received" },
  { key: "in_check", label: "In Check", stat: "inCheck", cls: "k-incheck" },
  { key: "completed", label: "Completed", stat: "completed", cls: "k-completed" },
];

function renderKpis(stats) {
  const host = $("kpis");
  host.innerHTML = KPI_DEFS.map(
    (k) => `<button type="button" class="kpi ${k.cls}${state.filters.status === k.key ? " is-active" : ""}"
        data-kpi="${k.key}" aria-pressed="${state.filters.status === k.key}">
      <span class="kpi-value">${Number(stats[k.stat] ?? 0).toLocaleString("en-PH")}</span>
      <span class="kpi-label">${esc(k.label)}</span>
    </button>`
  ).join("");
  host.querySelectorAll("[data-kpi]").forEach((btn) => {
    btn.onclick = () => {
      state.filters.status = btn.dataset.kpi;
      state.page = 1;
      refresh();
    };
  });
}

function syncFilterUi() {
  $("searchInput").value = state.filters.search;
  $("yearFilter").value = state.filters.year;
  $("monthFilter").value = state.filters.month;
  $("statusFilter").value = state.filters.status;
  const active = ["search", "year", "month", "status"].some((k) => state.filters[k]);
  $("clearFilters").style.display = active ? "" : "none";
  const chip = $("activeStatusChip");
  if (state.filters.status) {
    chip.innerHTML = `<span class="status-pill st-${esc(state.filters.status)}">${esc(statusLabel(state.filters.status))}</span>
      <button class="btn btn-ghost" id="clearStatusBtn" aria-label="Clear status filter">${icon("x")}</button>`;
    chip.style.display = "";
    $("clearStatusBtn").onclick = () => {
      state.filters.status = "";
      state.page = 1;
      refresh();
    };
  } else {
    chip.style.display = "none";
    chip.innerHTML = "";
  }
}

function applyFiltersFromUi() {
  state.filters.search = $("searchInput").value.trim();
  state.filters.year = $("yearFilter").value;
  state.filters.month = $("monthFilter").value;
  state.filters.status = $("statusFilter").value;
  state.page = 1;
  refresh();
}

function fillYearOptions() {
  const sel = $("yearFilter");
  const thisYear = new Date().getFullYear();
  let html = `<option value="">All years</option>`;
  for (let y = thisYear + 1; y >= thisYear - 10; y--) html += `<option value="${y}">${y}</option>`;
  sel.innerHTML = html;
}

function wireHeader() {
  document.querySelectorAll("[data-logo]").forEach((el) => (el.innerHTML = LOGO_SVG));
  const u = state.user;
  $("userName").textContent = u.fullName || u.email;
  $("userRole").textContent = u.role || "user";
  $("avatarInitial").textContent = (u.fullName || u.email || "?").trim().charAt(0).toUpperCase();
  $("logoutBtn").onclick = logout;
  $("logoutBtnMobile")?.addEventListener("click", logout);

  const burger = $("hamburger");
  const nav = $("mainNav");
  burger.onclick = () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  };
  nav.querySelectorAll("a, button").forEach((el) =>
    el.addEventListener("click", () => nav.classList.remove("open"))
  );

  $("newVoucherBtn").onclick = () => openVoucherModal(null, refresh);
  $("newVoucherBtnMobile")?.addEventListener("click", () => openVoucherModal(null, refresh));
  $("scanBtn").onclick = () => openScanner(onScanned);
  $("scanBtnMobile")?.addEventListener("click", () => openScanner(onScanned));
}

async function onScanned(text) {
  try {
    const res = await listVouchers({ search: text, page: 1, limit: 10 });
    const exact = res.data.find((v) => String(v.dvNo).trim().toLowerCase() === text.toLowerCase());
    const v = exact || res.data[0];
    if (!v) {
      toast(`No voucher found for "${text}".`, "error");
      return;
    }
    const callbacks = {
      onChanged: refresh,
      onEdit: (vv) => openVoucherModal(vv, refresh),
    };
    openDetail(v, state.isAdmin, callbacks);
  } catch (e) {
    toast(e.message, "error");
  }
}

function wireTableActions() {
  $("voucherBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const v = state.byId.get(id);
    if (!v && btn.dataset.act !== "delete") return;
    const callbacks = {
      onChanged: refresh,
      onEdit: (vv) => openVoucherModal(vv, refresh),
    };
    const act = btn.dataset.act;
    if (act === "view") openDetail(v, state.isAdmin, callbacks);
    else if (act === "qr") showQrModal(v);
    else if (act === "edit") openVoucherModal(v, refresh);
    else if (act === "stage") doStageAction(btn.dataset.stage, id, refresh);
    else if (act === "delete") {
      if (!state.isAdmin) return;
      doDelete(id, v?.dvNo, refresh);
    }
  });
}

function wireFilters() {
  fillYearOptions();
  const toggle = $("filtersToggle");
  const panel = $("filtersPanel");
  toggle.onclick = () => {
    const open = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  };

  let debounce;
  $("searchInput").addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(applyFiltersFromUi, 350);
  });
  $("yearFilter").addEventListener("change", applyFiltersFromUi);
  $("monthFilter").addEventListener("change", applyFiltersFromUi);
  $("statusFilter").addEventListener("change", applyFiltersFromUi);
  $("clearFilters").onclick = () => {
    state.filters = { search: "", year: "", month: "", status: "" };
    state.page = 1;
    refresh();
  };
  $("prevPage").onclick = () => {
    if (state.page > 1) {
      state.page--;
      refresh();
    }
  };
  $("nextPage").onclick = () => {
    state.page++;
    refresh();
  };
}

async function boot() {
  try {
    state.user = await getMe();
  } catch (e) {
    // 401s already redirected to login.html inside api(); anything else
    // (e.g. network down) gets a visible error on the shell page.
    if (!/login\.html$/.test(location.pathname)) toast(e.message, "error");
    return;
  }
  state.isAdmin = state.user.role === "admin";
  getCsrf().catch(() => {});
  wireHeader();
  wireFilters();
  wireTableActions();
  wireScannerButtons(onScanned);
  document.getElementById("voucherModalClose").onclick = () => closeModal("voucherModal");
  document.getElementById("voucherCancelBtn").onclick = () => closeModal("voucherModal");
  document.getElementById("qrClose").onclick = () => closeModal("qrModal");
  document.getElementById("scanClose").onclick = () => closeModal("scanModal");
  document.getElementById("drawerClose").onclick = () => {
    document.getElementById("drawerBackdrop").classList.remove("open");
    document.getElementById("drawer").classList.remove("open");
    document.body.style.overflow = "";
  };
  await refresh();
}

document.addEventListener("DOMContentLoaded", boot);
