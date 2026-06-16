import { createId, getState, setCurrentUser, updateState } from "./store.js";
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
    const user = state.users.find((item) => item.email.toLowerCase() === email && item.password === password);

    if (!user) {
      showToast("Invalid email or password.");
      return;
    }

    setCurrentUser(user.id);
    showToast(`Welcome back, ${user.name}.`);
    setTimeout(() => {
      window.location.href = user.role === "admin" ? "admin.html" : "../index.html";
    }, 550);
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const email = String(formData.get("email")).trim().toLowerCase();
    const state = getState();

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
    showToast("Account created. You can now book hotels.");
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 650);
  });
}
