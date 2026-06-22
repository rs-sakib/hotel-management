import { clearCurrentUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, initAuthChrome, initTheme, showToast, updateUserNavAvatar, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

initTheme();
initAuthChrome();
initCustomControls();
animatePage();

if (!isAdminUser(currentUser)) {
  accessWarning.hidden = false;
  adminContent.hidden = true;
} else {
  initAdminForms();
  renderAdminProfile();
}

document.querySelector("[data-logout]").addEventListener("click", () => {
  clearCurrentUser();
  window.location.href = "admin-login.html";
});

function renderAdminProfile() {
  const footer = document.querySelector("[data-admin-profile-footer]");
  if (!footer || !currentUser) return;
  footer.innerHTML = `
    ${userAvatarMarkup(currentUser, "avatar-circle")}
    <div class="profile-details">
      <span class="profile-name">${escapeHtml(currentUser.name)}</span>
      <span class="profile-role">${escapeHtml(currentUser.title || currentUser.role)}</span>
    </div>
  `;

  const profileCard = document.querySelector("[data-admin-profile-card]");
  if (profileCard) {
    profileCard.innerHTML = `
      <div class="admin-profile-cover"></div>
      <div class="admin-profile-avatar-wrap">
        <div class="admin-profile-avatar">${userAvatarMarkup(currentUser, "admin-profile-avatar-image")}</div>
        <label class="admin-profile-upload" title="Change photo" aria-label="Change profile photo">
          <input type="file" accept="image/png,image/jpeg,image/webp" data-admin-profile-image-input />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h3l1.6-2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
            <circle cx="12" cy="14" r="3.2" />
          </svg>
        </label>
      </div>
      <div class="admin-profile-summary">
        <p class="eyebrow">Signed in as</p>
        <h2>${escapeHtml(currentUser.name)}</h2>
        <p>${escapeHtml(currentUser.title || "Admin")} / ${escapeHtml(currentUser.department || "Operations")}</p>
      </div>
      <div class="admin-profile-facts">
        <article><span>Email</span><strong>${escapeHtml(currentUser.email)}</strong></article>
        <article><span>Phone</span><strong>${escapeHtml(currentUser.phone || "Not set")}</strong></article>
        <article><span>Location</span><strong>${escapeHtml(currentUser.location || "Not set")}</strong></article>
        <article><span>Status</span><strong>${escapeHtml(currentUser.status || "Active")}</strong></article>
      </div>
      <p class="admin-profile-bio">${escapeHtml(currentUser.bio || "No bio added yet.")}</p>
    `;
  }

  const form = document.querySelector("[data-admin-profile-form]");
  if (form) {
    form.elements.namedItem("name").value = currentUser.name || "";
    form.elements.namedItem("email").value = currentUser.email || "";
    form.elements.namedItem("phone").value = currentUser.phone || "";
    form.elements.namedItem("title").value = currentUser.title || "";
    form.elements.namedItem("department").value = currentUser.department || "";
    form.elements.namedItem("location").value = currentUser.location || "";
    form.elements.namedItem("status").value = currentUser.status || "Active";
    form.elements.namedItem("password").value = "";
    form.elements.namedItem("bio").value = currentUser.bio || "";
  }
}

function initAdminForms() {
  const profileForm = document.querySelector("[data-admin-profile-form]");
  profileForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(profileForm);
    const email = String(formData.get("email")).trim().toLowerCase();
    const state = getState();

    if (state.users.some((user) => user.id !== currentUser.id && user.email.toLowerCase() === email)) {
      showToast("Another account already uses this email.", "warning");
      return;
    }

    updateState((draft) => {
      const admin = draft.users.find((user) => user.id === currentUser.id);
      if (!admin) return;
      admin.name = String(formData.get("name")).trim();
      admin.email = email;
      admin.phone = String(formData.get("phone")).trim();
      admin.title = String(formData.get("title")).trim();
      admin.department = String(formData.get("department")).trim();
      admin.location = String(formData.get("location")).trim();
      admin.status = String(formData.get("status"));
      admin.bio = String(formData.get("bio")).trim();
      const nextPassword = String(formData.get("password")).trim();
      if (nextPassword) admin.password = nextPassword;

      Object.assign(currentUser, admin);
    });

    profileForm.reset();
    renderAdminProfile();
    updateUserNavAvatar(currentUser);
    showToast("Admin profile updated.");
  });

  profileForm?.addEventListener("reset", () => {
    window.setTimeout(renderAdminProfile, 0);
  });

  document.querySelector("[data-admin-profile-card]")?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-admin-profile-image-input]");
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please upload a valid image file.", "warning");
      input.value = "";
      return;
    }

    if (file.size > 750 * 1024) {
      showToast("Profile image must be under 750 KB.", "warning");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const avatar = String(reader.result || "");
      updateState((state) => {
        const admin = state.users.find((user) => user.id === currentUser.id);
        if (admin) {
          admin.avatar = avatar;
          currentUser.avatar = avatar;
        }
      });
      renderAdminProfile();
      updateUserNavAvatar(currentUser);
      showToast("Admin photo updated.");
    });
    reader.addEventListener("error", () => {
      showToast("Could not read that image file.", "warning");
    });
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
