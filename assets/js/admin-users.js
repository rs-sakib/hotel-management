import { clearCurrentUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, initAuthChrome, initTheme, showToast, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  users: { search: "", role: "all" }
};

initTheme();
initAuthChrome();
initCustomControls();
animatePage();

if (!isAdminUser(currentUser)) {
  accessWarning.hidden = false;
  adminContent.hidden = true;
} else {
  initAdminForms();
  initFilters();
  renderAdminProfile();
  renderUsersPage();
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
}

function initAdminForms() {
  document.querySelector("[data-users-table]")?.addEventListener("change", (event) => {
    const select = event.target.closest(".user-role-select");
    if (!select) return;

    const userId = select.dataset.userId;
    const nextRole = select.value;

    updateState((state) => {
      const user = state.users.find((u) => u.id === userId);
      if (user) {
        user.role = nextRole;
      }
    });

    renderUsersPage();
    showToast(`Role updated to ${nextRole.toUpperCase()}.`);
  });
}

function initFilters() {
  bindFilter("[data-filter-user-search]", "input", (event) => {
    filters.users.search = event.target.value.toLowerCase().trim();
    renderUsersPage();
  });
  bindFilter("[data-filter-user-role]", "change", (event) => {
    filters.users.role = event.target.value;
    renderUsersPage();
  });
}

function bindFilter(selector, eventName, handler) {
  const element = document.querySelector(selector);
  if (element) element.addEventListener(eventName, handler);
}

function renderUsersPage() {
  const state = getState();
  renderUsers(state);
  renderUsersSummary(state);
}

function renderUsers(state) {
  const filteredUsers = getFilteredUsers(state);
  document.querySelector("[data-users-table]").innerHTML = filteredUsers.length
    ? filteredUsers
      .map((user) => `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                ${userAvatarMarkup(user, "avatar-circle")}
                <strong>${escapeHtml(user.name)}</strong>
              </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.phone || "")}</td>
            <td>
              <select class="user-role-select" data-user-id="${user.id}" ${user.id === currentUser.id ? 'disabled' : ''} style="width: auto; height: 32px; padding: 0 0.5rem; border-radius: 6px; border: 1px solid var(--line); background: var(--surface-strong); color: var(--text); font-weight: 700; font-size: 0.78rem;">
                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </td>
            <td>${escapeHtml(user.status)}</td>
          </tr>
        `)
      .join("")
    : `<tr>
        <td colspan="5">
          <div class="table-empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <strong>No users found</strong>
            <p>No user directory entries matched the current search terms or role filters.</p>
          </div>
        </td>
      </tr>`;
}

function renderUsersSummary(state) {
  const userRows = getFilteredUsers(state);
  const root = document.querySelector("[data-user-summary]");
  if (!root) return;

  const items = [
    ["Visible users", userRows.length],
    ["Admins", userRows.filter((user) => user.role === "admin").length],
    ["Users", userRows.filter((user) => user.role === "user").length],
    ["Active", userRows.filter((user) => user.status === "Active").length]
  ];

  root.innerHTML = items
    .map(([label, value]) => `
      <article>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `)
    .join("");
}

function getFilteredUsers(state) {
  return state.users.filter((user) => {
    const search = filters.users.search;
    const matchesSearch = !search || user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search) || user.phone?.toLowerCase().includes(search);
    return matchesSearch && (filters.users.role === "all" || user.role === filters.users.role);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
