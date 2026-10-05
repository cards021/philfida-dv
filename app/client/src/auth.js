// Shared logic for login.html and signup.html.
import { getCsrf, api } from "./api.js";
import { toast, esc } from "./ui.js";
import { LOGO_SVG } from "./icons.js";

document.querySelectorAll("[data-logo]").forEach((el) => {
  el.innerHTML = LOGO_SVG;
});

const page = document.body.dataset.page;
const form = document.getElementById(page === "login" ? "loginForm" : "signupForm");
const errBox = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");

if (page === "login" && new URLSearchParams(location.search).get("registered") === "1") {
  document.getElementById("registeredOk").classList.add("show");
}

function showError(msg) {
  errBox.textContent = msg;
  errBox.classList.add("show");
}
function clearError() {
  errBox.textContent = "";
  errBox.classList.remove("show");
}

// Warm the CSRF token so the first submit never waits on it.
getCsrf().catch(() => toast("Could not reach the server.", "error"));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  submitBtn.disabled = true;
  const original = submitBtn.textContent;
  submitBtn.textContent = "Please wait…";
  try {
    if (page === "login") {
      const email = form.email.value.trim();
      const password = form.password.value;
      if (!email || !password) throw new Error("Please enter both your email and password.");
      await api("/api/auth/login", {
        method: "POST",
        body: { email, password, remember: form.remember.checked },
      });
      location.href = "/";
    } else {
      const fullName = form.fullName.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;
      const confirm = form.confirmPassword.value;
      if (!fullName || !email || !password) throw new Error("Please fill in every field.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (password !== confirm) throw new Error("Passwords do not match.");
      await api("/api/auth/signup", { method: "POST", body: { fullName, email, password } });
      location.href = "/login.html?registered=1";
    }
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = original;
  }
});
