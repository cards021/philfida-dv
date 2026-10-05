import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import { esc, toast, openModal, closeModal } from "./ui.js";
import { icon } from "./icons.js";

/** Show a QR code encoding the voucher's DV number. */
export async function showQrModal(v) {
  const dvNo = v.dvNo || String(v.id);
  document.getElementById("qrDvLabel").textContent = dvNo;
  const canvas = document.getElementById("qrCanvas");
  // Clear any previous render
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  try {
    await QRCode.toCanvas(canvas, dvNo, {
      width: 220,
      margin: 2,
      color: { dark: "#0a4d36", light: "#ffffff" },
    });
  } catch (e) {
    toast("Could not generate QR code.", "error");
    return;
  }
  openModal("qrModal");
}

/** Scanner modal: camera scan via html5-qrcode, with manual entry fallback. */
let scanner = null;
let scanning = false;

export function openScanner(onFound) {
  document.getElementById("scanError").textContent = "";
  document.getElementById("scanInput").value = "";
  openModal("scanModal");
  startScanner(onFound).catch((e) => {
    document.getElementById("scanError").textContent =
      "Camera unavailable (" + (e.message || "permission denied") + "). You can type the DV number below instead.";
  });
}

async function startScanner(onFound) {
  if (scanning) return;
  const region = document.getElementById("qr-reader");
  region.innerHTML = "";
  scanner = new Html5Qrcode("qr-reader");
  scanning = true;
  await scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 240, height: 240 } },
    (decoded) => {
      stopScanner();
      closeModal("scanModal");
      onFound(decoded.trim());
    },
    () => {}
  );
}

export async function stopScanner() {
  if (scanner && scanning) {
    scanning = false;
    try {
      await scanner.stop();
    } catch {}
    try {
      scanner.clear();
    } catch {}
    scanner = null;
  }
  scanning = false;
}

export function wireScannerButtons(onFound) {
  document.getElementById("scanGoBtn").onclick = () => {
    const v = document.getElementById("scanInput").value.trim();
    if (!v) {
      toast("Enter a DV number.", "error");
      return;
    }
    stopScanner();
    closeModal("scanModal");
    onFound(v);
  };
  document.getElementById("scanModal").addEventListener("transitionend", () => {
    if (!document.getElementById("scanModal").classList.contains("open")) stopScanner();
  });
}
