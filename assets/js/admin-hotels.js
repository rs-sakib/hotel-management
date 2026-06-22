import { clearCurrentUser, createId, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { loadHotelCatalog } from "./hotel-catalog.js";
import { animatePage, formatCurrency, initAuthChrome, initTheme, showToast, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  hotels: { search: "" }
};

let currentConfirmAction = null;

initTheme();
initAuthChrome();
initCustomControls();
animatePage();

if (!isAdminUser(currentUser)) {
  accessWarning.hidden = false;
  adminContent.hidden = true;
} else {
  await hydrateHotelCatalog();
  initAdminForms();
  initFilters();
  initConfirmModal();
  renderAdminProfile();
  renderHotelsPage();
}

document.querySelector("[data-logout]").addEventListener("click", () => {
  clearCurrentUser();
  window.location.href = "admin-login.html";
});

async function hydrateHotelCatalog() {
  const state = getState();
  const mergedHotels = await loadHotelCatalog(state.hotels || []);
  const currentIds = state.hotels.map((hotel) => hotel.id).join("|");
  const mergedIds = mergedHotels.map((hotel) => hotel.id).join("|");
  if (currentIds === mergedIds) return;

  updateState((draft) => {
    draft.hotels = mergedHotels;
  });
}

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
  document.querySelector("[data-hotel-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateState((state) => {
      state.hotels.unshift({
        id: createId("h"),
        name: String(formData.get("name")).trim(),
        city: String(formData.get("city")).trim(),
        rating: Number(formData.get("rating")),
        price: Number(formData.get("price")),
        rooms: Number(formData.get("rooms")),
        image: String(formData.get("image")).trim(),
        amenities: String(formData.get("amenities"))
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        description: String(formData.get("description")).trim()
      });
    });
    event.currentTarget.reset();
    renderHotelsPage();
    showToast("Hotel added to the portfolio.");
  });

  document.querySelector("[data-admin-hotels]").addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-hotel]");
    if (!deleteButton) return;
    const hotelId = deleteButton.dataset.deleteHotel;
    showConfirm("Remove this hotel and its related bookings?", () => {
      updateState((state) => {
        state.hotels = state.hotels.filter((hotel) => hotel.id !== hotelId);
        state.bookings = state.bookings.filter((booking) => booking.hotelId !== hotelId);
      });
      renderHotelsPage();
      showToast("Hotel removed.");
    });
  });
}

function initFilters() {
  bindFilter("[data-filter-hotel-search]", "input", (event) => {
    filters.hotels.search = event.target.value.toLowerCase().trim();
    renderHotelsPage();
  });
}

function bindFilter(selector, eventName, handler) {
  const element = document.querySelector(selector);
  if (element) element.addEventListener(eventName, handler);
}

function initConfirmModal() {
  const overlay = document.querySelector("[data-confirm-overlay]");
  const cancelButton = document.querySelector("[data-confirm-cancel]");
  const okButton = document.querySelector("[data-confirm-ok]");
  if (!overlay) return;

  const closeConfirm = () => {
    overlay.classList.remove("open");
    currentConfirmAction = null;
  };

  cancelButton.addEventListener("click", closeConfirm);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeConfirm();
  });
  okButton.addEventListener("click", () => {
    if (typeof currentConfirmAction === "function") currentConfirmAction();
    closeConfirm();
  });
}

function showConfirm(message, onConfirm) {
  const overlay = document.querySelector("[data-confirm-overlay]");
  const messageElement = document.querySelector("[data-confirm-message]");
  if (!overlay) {
    if (window.confirm(message)) onConfirm();
    return;
  }
  messageElement.textContent = message;
  currentConfirmAction = onConfirm;
  overlay.classList.add("open");
}

function renderHotelsPage() {
  const state = getState();
  renderHotels(state);
  renderHotelsSummary(state);
}

function renderHotels(state) {
  const filteredHotels = getFilteredHotels(state);
  document.querySelector("[data-hotel-count]").textContent =
    filteredHotels.length === state.hotels.length ? `${state.hotels.length} hotels` : `${filteredHotels.length} of ${state.hotels.length} hotels`;

  document.querySelector("[data-admin-hotels]").innerHTML = filteredHotels.length
    ? filteredHotels
      .map((hotel) => `
          <article class="admin-hotel-card">
            <img src="${escapeAttr(hotel.image || "")}" alt="${escapeAttr(hotel.name)}" loading="lazy" />
            <div class="admin-hotel-card-body">
              <div>
                <h3>${escapeHtml(hotel.name)}</h3>
                <p>${escapeHtml(hotel.city)} / ${formatCurrency(hotel.price)} per night / ${Number(hotel.rooms)} rooms / ${Number(hotel.rating).toFixed(1)} rating</p>
              </div>
              <div class="action-row">
                ${(hotel.amenities || []).slice(0, 3).map((amenity) => `<span class="status-pill">${escapeHtml(amenity)}</span>`).join("")}
                <button class="pill-button delete" type="button" data-delete-hotel="${hotel.id}">Delete</button>
              </div>
            </div>
          </article>
        `)
      .join("")
    : `<div class="empty-state">No hotels found.</div>`;
}

function renderHotelsSummary(state) {
  const hotelRows = getFilteredHotels(state);
  const root = document.querySelector("[data-hotel-summary]");
  if (!root) return;

  const items = [
    ["Visible hotels", hotelRows.length],
    ["Rooms", hotelRows.reduce((sum, hotel) => sum + Number(hotel.rooms || 0), 0)],
    ["Cities", groupCount(hotelRows, (hotel) => hotel.city).length],
    ["Avg rate", formatCurrency(average(hotelRows.map((hotel) => Number(hotel.price || 0))))]
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

function getFilteredHotels(state) {
  return state.hotels.filter((hotel) => {
    const search = filters.hotels.search;
    return !search || hotel.name.toLowerCase().includes(search) || hotel.city.toLowerCase().includes(search) || (hotel.amenities || []).join(" ").toLowerCase().includes(search);
  });
}

function groupCount(items, getKey) {
  const counts = new Map();
  items.forEach((item) => {
    const key = getKey(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
