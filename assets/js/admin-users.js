import { clearCurrentUser, getCurrentUser, getState, isAdminUser } from "./store.js";
import { animatePage, initAuthChrome, initTheme, userAvatarMarkup } from "./ui.js";
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
            <td><strong>${escapeHtml(user.name)}</strong></td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.phone || "")}</td>
            <td>${escapeHtml(user.role)}</td>
            <td>${escapeHtml(user.status)}</td>
          </tr>
        `)
      .join("")
    : `<tr><td colspan="5">No users found.</td></tr>`;
}

function renderUsersSummary(state) {
  const userRows = getFilteredUsers(state);
  const root = document.querySelector("[data-user-summary]");
  if (!root) return;

  const items = [
    ["Visible users", userRows.length],
    ["Admins", userRows.filter((user) => user.role === "admin").length],
    ["Guests", userRows.filter((user) => user.role === "guest").length],
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
