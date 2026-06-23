import { clearCurrentUser, createId, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { loadHotelCatalog } from "./hotel-catalog.js";
import { animatePage, formatCurrency, initAuthChrome, initTheme, showToast, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  hotels: { search: "", city: "all", rating: "all", sort: "default" }
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
  populateCityFilter();
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
  const hotelForm = document.querySelector("[data-hotel-form]");
  const cancelEditButton = document.querySelector("[data-cancel-hotel-edit]");

  hotelForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const editingHotelId = String(formData.get("hotelId") || "").trim();
    const hotelData = getHotelFormData(formData, editingHotelId || createId("h"));

    updateState((state) => {
      if (editingHotelId) {
        state.hotels = state.hotels.map((hotel) => hotel.id === editingHotelId ? { ...hotel, ...hotelData } : hotel);
        return;
      }
      state.hotels.unshift(hotelData);
    });

    resetHotelForm(form);
    populateCityFilter();
    renderHotelsPage();
    showToast(editingHotelId ? "Hotel updated." : "Hotel added to the portfolio.");
  });

  document.querySelector("[data-admin-hotels]").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-hotel]");
    if (editButton) {
      const hotel = getState().hotels.find((item) => item.id === editButton.dataset.editHotel);
      if (hotel) fillHotelForm(hotelForm, hotel);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-hotel]");
    if (!deleteButton) return;
    const hotelId = deleteButton.dataset.deleteHotel;
    showConfirm("Remove this hotel and its related bookings?", () => {
      updateState((state) => {
        state.hotels = state.hotels.filter((hotel) => hotel.id !== hotelId);
        state.bookings = state.bookings.filter((booking) => booking.hotelId !== hotelId);
      });
      resetHotelForm(hotelForm);
      populateCityFilter();
      renderHotelsPage();
      showToast("Hotel removed.");
    });
  });

  cancelEditButton.addEventListener("click", () => resetHotelForm(hotelForm));
}

function getHotelFormData(formData, id) {
  return {
    id,
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
  };
}

function fillHotelForm(form, hotel) {
  form.elements.hotelId.value = hotel.id;
  form.elements.name.value = hotel.name || "";
  form.elements.city.value = hotel.city || "";
  form.elements.rating.value = Number(hotel.rating || 0);
  form.elements.price.value = Number(hotel.price || 0);
  form.elements.rooms.value = Number(hotel.rooms || 0);
  form.elements.image.value = hotel.image || "";
  form.elements.amenities.value = (hotel.amenities || []).join(", ");
  form.elements.description.value = hotel.description || "";
  setHotelEditMode(true);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetHotelForm(form) {
  form.reset();
  form.elements.hotelId.value = "";
  setHotelEditMode(false);
}

function setHotelEditMode(isEditing) {
  const submitLabel = document.querySelector("[data-hotel-submit-label]");
  const cancelEditButton = document.querySelector("[data-cancel-hotel-edit]");
  if (submitLabel) submitLabel.textContent = isEditing ? "Update hotel" : "Add hotel";
  if (cancelEditButton) cancelEditButton.hidden = !isEditing;
}

function populateCityFilter() {
  const state = getState();
  const cities = [...new Set(state.hotels.map((h) => h.city).filter(Boolean))].sort();
  const select = document.querySelector("[data-filter-hotel-city]");
  if (!select) return;
  select.innerHTML = `<option value="all">All locations</option>` +
    cities.map((city) => {
      const label = city.split(",")[0].trim(); // show only city, not country
      return `<option value="${escapeAttr(city)}">${escapeHtml(label)}</option>`;
    }).join("");
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function initFilters() {
  bindFilter("[data-filter-hotel-search]", "input", (event) => {
    filters.hotels.search = event.target.value.toLowerCase().trim();
    renderHotelsPage();
  });
  bindFilter("[data-filter-hotel-city]", "change", (event) => {
    filters.hotels.city = event.target.value;
    renderHotelsPage();
  });
  bindFilter("[data-filter-hotel-rating]", "change", (event) => {
    filters.hotels.rating = event.target.value;
    renderHotelsPage();
  });
  bindFilter("[data-filter-hotel-sort]", "change", (event) => {
    filters.hotels.sort = event.target.value;
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
              <div class="admin-hotel-card-footer">
                <div class="admin-hotel-badges">
                  ${(hotel.amenities || []).slice(0, 3).map((amenity) => `<span class="status-pill">${escapeHtml(amenity)}</span>`).join("")}
                </div>
                <div class="admin-hotel-actions">
                  <button class="pill-button" type="button" data-edit-hotel="${hotel.id}">Edit</button>
                  <button class="pill-button delete" type="button" data-delete-hotel="${hotel.id}">Delete</button>
                </div>
              </div>
            </div>
          </article>
        `)
      .join("")
    : `
      <div class="grid-empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
            <path d="M9 22v-4h6v4"></path>
            <path d="M8 6h.01"></path>
            <path d="M16 6h.01"></path>
            <path d="M8 10h.01"></path>
            <path d="M16 10h.01"></path>
          </svg>
        </div>
        <strong>No hotels found</strong>
        <p>We couldn't find any hotels matching your filter. Try adjusting your search query or add a new hotel.</p>
      </div>
    `;
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
  const { search, city, rating, sort } = filters.hotels;
  const matched = state.hotels.filter((hotel) => {
    const haystack = [hotel.name, hotel.city, hotel.description, ...(hotel.amenities || [])].join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesCity = city === "all" || hotel.city === city;
    const matchesRating = rating === "all" || Number(hotel.rating) >= Number(rating);
    return matchesSearch && matchesCity && matchesRating;
  });
  return sortHotels(matched, sort);
}

function sortHotels(hotels, sort) {
  return [...hotels].sort((a, b) => {
    if (sort === "price-asc") return Number(a.price) - Number(b.price);
    if (sort === "price-desc") return Number(b.price) - Number(a.price);
    if (sort === "rating-desc") return Number(b.rating) - Number(a.rating);
    return 0; // default: preserve original order
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
