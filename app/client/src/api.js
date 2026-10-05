// Central API layer: same-origin fetch, CSRF header on mutations,
// JSON handling, and global 401 → login redirect.
import { toast } from "./ui.js";

let csrfToken = null;

export async function getCsrf() {
  if (csrfToken) return csrfToken;
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not reach the server.");
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

function authFailed() {
  // Any 401 anywhere means the session is gone → back to sign-in.
  if (!location.pathname.endsWith("login.html")) location.href = "/login.html";
}

export async function api(path, { method = "GET", body = undefined } = {}) {
  const headers = {};
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (method !== "GET" && method !== "HEAD") {
    headers["X-CSRF-Token"] = await getCsrf();
  }
  let res;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  if (res.status === 401) {
    // Parse the body first so auth pages can show the real error
    // (e.g. "Incorrect email or password") instead of a generic one.
    let data = null;
    try {
      data = JSON.parse(await res.text());
    } catch {}
    const onAuthPage = /login\.html$|signup\.html$/.test(location.pathname);
    if (!onAuthPage) authFailed(); // redirects to login.html
    throw new Error((data && data.error) || "Session expired. Please sign in again.");
  }
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Unexpected server response.");
    }
  }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status}).`);
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const getMe = () => api("/api/auth/me");

export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (e) {
    // Even if the call fails, drop the local session view.
    toast(e.message, "error");
  }
  location.href = "/login.html";
}

/* ---- Vouchers ---- */
export function listVouchers({ search = "", year = "", month = "", status = "", page = 1, limit = 50 }) {
  const p = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) p.set("search", search);
  if (year) p.set("year", year);
  if (month) p.set("month", month);
  if (status) p.set("status", status);
  return api("/api/vouchers?" + p.toString());
}
export const getStats = () => api("/api/vouchers/stats");
export const nextNumber = () => api("/api/vouchers/next-number");
export const createVoucher = (data) => api("/api/vouchers", { method: "POST", body: data });
export const updateVoucher = (id, data) => api(`/api/vouchers/${encodeURIComponent(id)}`, { method: "PATCH", body: data });
export const deleteVoucher = (id) => api(`/api/vouchers/${encodeURIComponent(id)}`, { method: "DELETE" });
export const markReceived = (id, remarks) =>
  api(`/api/vouchers/${encodeURIComponent(id)}/receive`, { method: "POST", body: { remarks: remarks || "" } });
export const markReleased = (id, remarks) =>
  api(`/api/vouchers/${encodeURIComponent(id)}/release`, { method: "POST", body: { remarks: remarks || "" } });
export const markCheckReceived = (id) => api(`/api/vouchers/${encodeURIComponent(id)}/check-receive`, { method: "POST", body: {} });
export const markCheckReleased = (id) => api(`/api/vouchers/${encodeURIComponent(id)}/check-release`, { method: "POST", body: {} });
