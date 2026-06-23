import { clearCurrentUser, getCurrentUser, isAdminUser } from "./store.js";

const themeIcons = {
  light: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  `,
  dark: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
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

function getUserInitials(user) {
  return String(user?.name || "User")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export function userAvatarMarkup(user, className = "user-avatar") {
  if (user?.avatar) {
    return `<img class="${className}" src="${user.avatar}" alt="${user.name || "User"} profile image" />`;
  }
  return `<span class="${className} initials">${getUserInitials(user)}</span>`;
}

export function updateUserNavAvatar(user = getCurrentUser()) {
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions) return;

  let avatarLink = headerActions.querySelector("[data-user-nav-avatar]");
  if (!user) {
    avatarLink?.remove();
    return;
  }

  const inPagesDirectory = window.location.pathname.includes("/pages/");
  const pagePrefix = inPagesDirectory ? "" : "pages/";
  const href = isAdminUser(user) ? `${pagePrefix}admin.html` : `${pagePrefix}dashboard.html`;

  if (!avatarLink) {
    avatarLink = document.createElement("a");
    avatarLink.className = "header-user-avatar";
    avatarLink.dataset.userNavAvatar = "";
    const logoutButton = headerActions.querySelector("[data-logout]");
    headerActions.insertBefore(avatarLink, logoutButton || null);
  }

  avatarLink.href = href;
  avatarLink.setAttribute("aria-label", `${user.name || "User"} profile`);
  avatarLink.title = user.name || "User profile";
  avatarLink.innerHTML = userAvatarMarkup(user, "nav-avatar");
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

  updateUserNavAvatar(currentUser);

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
    currency: "BDT",
    maximumFractionDigits: 0
  }).format(Number(value));
}

export function formatStatus(status) {
  const formatted = String(status || '').replaceAll('-', ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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
