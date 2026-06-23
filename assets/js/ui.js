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

export function adminStatIcon(type) {
  const icons = {
    hotel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5.8C4 4.8 4.8 4 5.8 4h8.4c1 0 1.8.8 1.8 1.8V21M16 9h2.2c1 0 1.8.8 1.8 1.8V21M8 8h4M8 12h4M8 16h4M3 21h18"/></svg>`,
    booking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M6 5h12c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2z"/></svg>`,
    rate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    room: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19V7M21 19v-5.5A3.5 3.5 0 0 0 17.5 10H12v9M3 14h18M3 10h6a3 3 0 0 1 3 3v1M3 19h18"/></svg>`
  };
  return icons[type] || "";
}

export function counterValueMarkup(value) {
  const num = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  if (!isNaN(num) && String(value).trim() !== String(num)) {
    // formatted value like currency — just display as-is
    return `<span data-counter="${num}">${value}</span>`;
  }
  return `<span data-counter="${num ?? value}">${value}</span>`;
}

export function animateCounters(root) {
  if (!window.gsap) return;
  root.querySelectorAll("[data-counter]").forEach((el) => {
    const target = parseFloat(el.dataset.counter);
    if (isNaN(target)) return;
    const original = el.textContent;
    const isCurrency = original.includes("৳") || original.includes("$") || original.includes(",");
    window.gsap.fromTo(
      { val: 0 },
      { val: target, duration: 1.2, ease: "power2.out",
        onUpdate: function () {
          if (isCurrency) {
            el.textContent = original.replace(/[\d,]+(\.\d+)?/, Math.round(this.targets()[0].val).toLocaleString());
          } else {
            el.textContent = Math.round(this.targets()[0].val);
          }
        },
        onComplete: function () {
          el.textContent = original;
        }
      }
    );
  });
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

const _summaryIcons = {
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>`,
  active: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  trip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l4-8 4 4 4-6 4 10"/><path d="M3 21h18"/></svg>`,
  pending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  transaction: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  paid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  hotel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5.8C4 4.8 4.8 4 5.8 4h8.4c1 0 1.8.8 1.8 1.8V21M16 9h2.2c1 0 1.8.8 1.8 1.8V21M8 8h4M8 12h4M8 16h4M3 21h18"/></svg>`,
  room: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19V7M21 19v-5.5A3.5 3.5 0 0 0 17.5 10H12v9M3 14h18M3 10h6a3 3 0 0 1 3 3v1M3 19h18"/></svg>`,
  city: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M9 21V7l7-4v18"/><path d="M3 21V11l6-4"/><path d="M12 8h2M12 12h2M12 16h2"/></svg>`,
  rate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  booking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M6 5h12c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2z"/></svg>`
};

export function renderAdminSummary(root, items) {
  if (!root) return;
  root.innerHTML = items
    .map(({ label, value, icon, tone }) => `
      <article class="metric-card ${tone || ""}">
        <div class="metric-info">
          <span>${String(label)}</span>
          <strong>${String(value)}</strong>
        </div>
        <div class="metric-icon">${_summaryIcons[icon] || ""}</div>
      </article>
    `)
    .join("");
  if (window.gsap) {
    const cards = root.querySelectorAll(".metric-card");
    if (cards.length) {
      window.gsap.from(cards, {
        opacity: 0, y: 14, duration: 0.45, stagger: 0.07, ease: "power2.out"
      });
    }
  }
}

