import { ADMIN_EMAIL, ADMIN_USER_ID, createId, getState, setCurrentUser, updateState } from "./store.js";
import { animatePage, initTheme, showToast } from "./ui.js";

const authHeroCopy = {
  guest: {
    layout: "user",
    title: "Welcome back to your user dashboard.",
    copy: "Use your user account to manage bookings, payments, notifications, and trip updates."
  },
  admin: {
    layout: "admin",
    title: "Control today's hotel operations.",
    copy: "Use the admin workspace to review bookings, manage hotels, track users, and monitor performance."
  }
};

initTheme();
animatePage();
initRoleLoginPanels();

const loginForms = document.querySelectorAll("[data-login-form]");
const signupForm = document.querySelector("[data-signup-form]");

loginForms.forEach((loginForm) => {
  loginForm.addEventListener("submit", handleLoginSubmit);
});

function initRoleLoginPanels() {
  const roleLogin = document.querySelector("[data-role-login]");
  if (!roleLogin) return;
  const authLayout = document.querySelector("[data-auth-layout]");
  const authTitle = document.querySelector("[data-auth-art-title]");
  const authCopy = document.querySelector("[data-auth-art-copy]");

  const setRole = (role) => {
    const selectedRole = authHeroCopy[role] ? role : "guest";
    const selectedCopy = authHeroCopy[selectedRole];

    roleLogin.dataset.activeRole = selectedRole;
    authLayout?.setAttribute("data-auth-layout", selectedCopy.layout);
    if (authTitle) authTitle.textContent = selectedCopy.title;
    if (authCopy) authCopy.textContent = selectedCopy.copy;

    roleLogin.querySelectorAll("[data-role-toggle]").forEach((button) => {
      const isActive = button.dataset.roleToggle === selectedRole;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    roleLogin.querySelectorAll("[data-role-panel]").forEach((panel) => {
      const isActive = panel.dataset.rolePanel === selectedRole;
      panel.classList.toggle("active", isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
      panel.querySelectorAll("input, button").forEach((control) => {
        control.disabled = !isActive;
      });
    });
  };

  setRole(roleLogin.dataset.activeRole || "guest");

  roleLogin.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-role-toggle]");
    if (!toggle) return;
    setRole(toggle.dataset.roleToggle);
  });
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const loginForm = event.currentTarget;
  const formData = new FormData(loginForm);
  const email = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));
  const loginScope = loginForm.dataset.loginScope || "guest";
  const state = getState();
  const adminUser = state.users.find((item) => item.id === ADMIN_USER_ID);
  const adminEmail = String(adminUser?.email || ADMIN_EMAIL).toLowerCase();
  const isAdminLogin = Boolean(adminUser && email === adminEmail && password === adminUser.password);

  if (loginScope === "guest" && email === adminEmail) {
    showToast("Admin accounts must use the Admin section.");
    return;
  }

  if (loginScope === "admin" && !isAdminLogin) {
    showToast("Admin login accepts administrator credentials only.");
    return;
  }

  const user = loginScope === "admin"
    ? adminUser
    : state.users.find((item) => item.role !== "admin" && item.email.toLowerCase() === email && item.password === password);

  if (!user) {
    showToast("Invalid email or password.");
    return;
  }

  setCurrentUser(user.id);
  showToast(`Welcome back, ${user.name}.`);
  setTimeout(() => {
    window.location.href = loginScope === "admin" ? "admin.html" : "dashboard.html";
  }, 550);
}

if (signupForm) {
  signupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const email = String(formData.get("email")).trim().toLowerCase();
    const state = getState();

    const adminUser = state.users.find((user) => user.id === ADMIN_USER_ID);
    if (email === ADMIN_EMAIL || email === adminUser?.email?.toLowerCase()) {
      showToast("This email is reserved for the admin account.");
      return;
    }

    if (state.users.some((user) => user.email.toLowerCase() === email)) {
      showToast("An account already exists for this email.");
      return;
    }

    let newUserId = "";
    updateState((draft) => {
      newUserId = createId("u");
      draft.users.push({
        id: newUserId,
        name: String(formData.get("name")).trim(),
        email,
        phone: String(formData.get("phone")).trim(),
        password: String(formData.get("password")),
        role: "user",
        status: "Active"
      });
    });

    setCurrentUser(newUserId);
    showToast("Account created. Opening your dashboard.");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 650);
  });
}
