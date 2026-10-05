import { api, markReceived, markReleased, markCheckReceived, markCheckReleased, deleteVoucher } from "./api.js";
import { toast, openModal, closeModal, confirmDialog, esc } from "./ui.js";

const STAGE_LABEL = {
  receive: "Mark Received",
  release: "Mark Released",
  "check-receive": "Check Received",
  "check-release": "Check Released",
};

/** Ask for optional remarks, then run the stage action. */
export async function doStageAction(stageKey, id, onChanged) {
  const needsRemarks = stageKey === "receive" || stageKey === "release";
  let remarks = "";
  if (needsRemarks) {
    remarks = await promptRemarks(STAGE_LABEL[stageKey]);
    if (remarks === null) return; // cancelled
  } else {
    const ok = await confirmDialog({
      title: STAGE_LABEL[stageKey],
      message: "Record this workflow stage for the voucher?",
      confirmLabel: STAGE_LABEL[stageKey],
    });
    if (!ok) return;
  }
  try {
    if (stageKey === "receive") await markReceived(id, remarks);
    else if (stageKey === "release") await markReleased(id, remarks);
    else if (stageKey === "check-receive") await markCheckReceived(id);
    else if (stageKey === "check-release") await markCheckReleased(id);
    toast("Voucher updated.", "success");
    onChanged && onChanged();
  } catch (e) {
    toast(e.message, "error");
  }
}

function promptRemarks(title) {
  return new Promise((resolve) => {
    const bd = document.getElementById("remarksModal");
    bd.querySelector("[data-remarks-title]").textContent = title;
    const input = bd.querySelector("[data-remarks-input]");
    input.value = "";
    const done = (v) => {
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      closeModal("remarksModal");
      resolve(v);
    };
    const okBtn = bd.querySelector("[data-remarks-ok]");
    const cancelBtn = bd.querySelector("[data-remarks-cancel]");
    okBtn.onclick = () => done(input.value.trim());
    cancelBtn.onclick = () => done(null);
    openModal("remarksModal");
  });
}

export async function doDelete(id, dvNo, onChanged) {
  const ok = await confirmDialog({
    title: "Delete Voucher",
    message: `Permanently delete voucher ${dvNo ? `"${dvNo}"` : `#${id}`}? This cannot be undone.`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!ok) return;
  try {
    await deleteVoucher(id);
    toast("Voucher deleted.", "success");
    onChanged && onChanged();
  } catch (e) {
    toast(e.message, "error");
  }
}
