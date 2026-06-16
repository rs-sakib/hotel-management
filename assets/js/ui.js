import { clearCurrentUser, getCurrentUser } from "./store.js";

export function initTheme() {
  const savedTheme = localStorage.getItem("azurestay-theme") || "light";
  document.documentElement.dataset.theme = savedTheme;
  updateThemeButtons(savedTheme);

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem("azurestay-theme", nextTheme);
      updateThemeButtons(nextTheme);
    });
  });
}

function updateThemeButtons(theme) {
  document.querySelectorAll("[data-theme-icon]").forEach((icon) => {
    icon.textContent = theme === "dark" ? "☾" : "☀";
  });
  document.querySelectorAll("[data-theme-label]").forEach((label) => {
    label.textContent = theme === "dark" ? "Dark" : "Light";
  });
}

export function initHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

export function initAuthChrome() {
  const currentUser = getCurrentUser();
  const authLink = document.querySelector("[data-auth-link]");
  const logoutButton = document.querySelector("[data-logout]");

  if (authLink && currentUser) {
    authLink.textContent = currentUser.role === "admin" ? "Admin" : currentUser.name.split(" ")[0];
    authLink.href = currentUser.role === "admin" ? "pages/admin.html" : "pages/login.html";
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      clearCurrentUser();
      showToast("Logged out successfully.");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 500);
    });
  }
}

export function showToast(message, tone = "default") {
  const stack = document.querySelector("[data-toast-stack]");
  if (!stack) return;
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  stack.appendChild(toast);

  if (window.gsap) {
    window.gsap.fromTo(toast, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: "power2.out" });
  }

  setTimeout(() => {
    if (window.gsap) {
      window.gsap.to(toast, { y: 12, opacity: 0, duration: 0.22, onComplete: () => toast.remove() });
    } else {
      toast.remove();
    }
  }, 3200);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value));
}

export function formatStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusPill(status) {
  return `<span class="status-pill ${status}">${formatStatus(status)}</span>`;
}

export function animatePage() {
  if (!window.gsap) return;
  window.gsap.from("body", { opacity: 0, duration: 0.28, ease: "power2.out" });
  window.gsap.from(".auth-card, .admin-sidebar, .admin-topbar, .admin-section.active", {
    y: 18,
    opacity: 0,
    duration: 0.55,
    stagger: 0.08,
    ease: "power3.out"
  });
}
