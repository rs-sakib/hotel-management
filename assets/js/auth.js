import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USER_ID, createId, getState, setCurrentUser, updateState } from "./store.js";
import { animatePage, initTheme, showToast } from "./ui.js";

initTheme();
animatePage();

const loginForm = document.querySelector("[data-login-form]");
const signupForm = document.querySelector("[data-signup-form]");

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = String(formData.get("email")).trim().toLowerCase();
    const password = String(formData.get("password"));
    const state = getState();
    const isAdminLogin = email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
    const user = isAdminLogin ? state.users.find((item) => item.id === ADMIN_USER_ID) : state.users.find((item) => item.role !== "admin" && item.email.toLowerCase() === email && item.password === password);

    if (!user) {
      showToast("Invalid email or password.");
      return;
    }

    setCurrentUser(user.id);
    showToast(`Welcome back, ${user.name}.`);
    setTimeout(() => {
      window.location.href = isAdminLogin ? "admin.html" : "dashboard.html";
    }, 550);
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const email = String(formData.get("email")).trim().toLowerCase();
    const state = getState();

    if (email === ADMIN_EMAIL) {
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
        role: "guest",
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
