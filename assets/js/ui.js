import { clearCurrentUser, getCurrentUser, isAdminUser } from "./store.js";

const themeIcons = {
  light: `
    <svg viewBox="0 0 24 24" role="img">
      <path d="M11 2h2v3h-2V2Zm0 17h2v3h-2v-3ZM2 11h3v2H2v-2Zm17 0h3v2h-3v-2ZM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1Zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1Zm2.1-13.5 1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1ZM6.3 16.3l1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </svg>
  `,
  dark: `
    <svg viewBox="0 0 24 24" role="img">
      <path d="M20.4 14.6A8.2 8.2 0 0 1 9.4 3.6 9 9 0 1 0 20.4 14.6ZM12 21a7 7 0 0 1-4.5-12.4 10.1 10.1 0 0 0 7.9 7.9A7 7 0 0 1 12 21Z" />
    </svg>
  `
};

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
    icon.innerHTML = themeIcons[theme] || themeIcons.light;
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
  const signupLink = document.querySelector("[data-signup-link]");
  const adminPromos = document.querySelectorAll("[data-admin-promo]");
  const logoutButton = document.querySelector("[data-logout]");
  const inPagesDirectory = window.location.pathname.includes("/pages/");
  const pagePrefix = inPagesDirectory ? "" : "pages/";

  if (authLink && currentUser) {
    authLink.textContent = isAdminUser(currentUser) ? "Admin panel" : "Dashboard";
    authLink.href = isAdminUser(currentUser) ? `${pagePrefix}admin.html` : `${pagePrefix}dashboard.html`;
  }

  if (signupLink && currentUser) {
    signupLink.hidden = true;
  }

  if (adminPromos.length && currentUser && !isAdminUser(currentUser)) {
    adminPromos.forEach((promo) => {
      promo.hidden = true;
    });
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
  const pageTargets = document.querySelectorAll(".auth-card, .admin-sidebar, .admin-topbar, .admin-section.active");
  if (pageTargets.length) {
    window.gsap.from(pageTargets, {
      y: 18,
      opacity: 0,
      duration: 0.55,
      stagger: 0.08,
      ease: "power3.out"
    });
  }
}
