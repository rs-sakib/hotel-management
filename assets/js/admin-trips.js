import { clearCurrentUser, createId, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, initAuthChrome, initTheme, renderAdminSummary, showToast, statusPill, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  trips: { search: "", status: "all", type: "all", sort: "default" }
};

let currentConfirmAction = null;
const legacyTripIds = new Set(["t-1", "t-2", "t-3"]);

initTheme();
initAuthChrome();
initCustomControls();
animatePage();

if (!isAdminUser(currentUser)) {
  accessWarning.hidden = false;
  adminContent.hidden = true;
} else {
  await hydrateTripCatalog();
  initAdminForms();
  initFilters();
  initConfirmModal();
  renderAdminProfile();
  renderTripsPage();
}

document.querySelector("[data-logout]").addEventListener("click", () => {
  clearCurrentUser();
  window.location.href = "admin-login.html";
});

async function hydrateTripCatalog() {
  try {
    const response = await fetch("../assets/data/trips.json");
    if (!response.ok) return;
    const catalogTrips = await response.json();
    if (!Array.isArray(catalogTrips) || !catalogTrips.length) return;

    updateState((state) => {
      const existingTrips = (state.trips || []).filter((trip) => !legacyTripIds.has(trip.id));
      const existingById = new Map(existingTrips.map((trip) => [trip.id, trip]));
      const mergedCatalog = catalogTrips.map((trip) => ({ ...trip, ...(existingById.get(trip.id) || {}) }));
      const catalogIds = new Set(catalogTrips.map((trip) => trip.id));
      const customTrips = existingTrips.filter((trip) => !catalogIds.has(trip.id));
      state.trips = [...customTrips, ...mergedCatalog];
    });
  } catch {
    // Keep stored trips if the JSON catalog cannot be loaded.
  }
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
  const tripForm = document.querySelector("[data-trip-form]");
  tripForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(tripForm);
    const editingId = String(formData.get("tripId") || "");
    const nextTrip = getTripFromForm(formData, editingId || createId("trip"));

    updateState((state) => {
      if (editingId) {
        state.trips = state.trips.map((trip) => (trip.id === editingId ? nextTrip : trip));
      } else {
        state.trips.unshift(nextTrip);
      }
    });

    resetTripForm();
    renderTripsPage();
    showToast(editingId ? "Trip updated." : "Trip added.");
  });

  document.querySelector("[data-admin-trips]").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-trip]");
    if (editButton) {
      const trip = getState().trips.find((item) => item.id === editButton.dataset.editTrip);
      if (trip) fillTripForm(trip);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-trip]");
    if (!deleteButton) return;
    const tripId = deleteButton.dataset.deleteTrip;
    showConfirm("Remove this trip?", () => {
      updateState((state) => {
        state.trips = state.trips.filter((trip) => trip.id !== tripId);
      });
      renderTripsPage();
      showToast("Trip removed.");
    });
  });

  document.querySelector("[data-cancel-trip-edit]").addEventListener("click", resetTripForm);
}

function getTripFromForm(formData, id) {
  return {
    id,
    title: String(formData.get("title")).trim(),
    type: String(formData.get("type")).trim(),
    guest: String(formData.get("guest")).trim(),
    destination: String(formData.get("destination")).trim(),
    dates: String(formData.get("dates")).trim(),
    status: String(formData.get("status")),
    duration: String(formData.get("duration")).trim(),
    stays: Number(formData.get("stays")),
    budget: Number(formData.get("budget")),
    manager: String(formData.get("manager")).trim(),
    image: String(formData.get("image")).trim(),
    concierge: String(formData.get("concierge")).trim()
  };
}

function fillTripForm(trip) {
  const form = document.querySelector("[data-trip-form]");
  form.elements.tripId.value = trip.id;
  form.elements.title.value = trip.title || "";
  form.elements.type.value = trip.type || "";
  form.elements.guest.value = trip.guest || "";
  form.elements.destination.value = trip.destination || "";
  form.elements.dates.value = trip.dates || "";
  form.elements.duration.value = trip.duration || "";
  form.elements.stays.value = Number(trip.stays || 0);
  form.elements.budget.value = Number(trip.budget || 0);
  form.elements.manager.value = trip.manager || "";
  form.elements.image.value = trip.image || "";
  form.elements.concierge.value = trip.concierge || "";
  form.elements.status.value = trip.status || "Planning";
  form.elements.status.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("[data-trip-submit-label]").textContent = "Save trip";
  document.querySelector("[data-cancel-trip-edit]").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetTripForm() {
  const form = document.querySelector("[data-trip-form]");
  form.reset();
  form.elements.tripId.value = "";
  form.elements.status.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("[data-trip-submit-label]").textContent = "Add trip";
  document.querySelector("[data-cancel-trip-edit]").hidden = true;
}

function initFilters() {
  bindFilter("[data-filter-trip-search]", "input", (event) => {
    filters.trips.search = event.target.value.toLowerCase().trim();
    renderTripsPage();
  });
  bindFilter("[data-filter-trip-status]", "change", (event) => {
    filters.trips.status = event.target.value;
    renderTripsPage();
  });
  bindFilter("[data-filter-trip-type]", "change", (event) => {
    filters.trips.type = event.target.value;
    renderTripsPage();
  });
  bindFilter("[data-filter-trip-sort]", "change", (event) => {
    filters.trips.sort = event.target.value;
    renderTripsPage();
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

function renderTripsPage() {
  const state = getState();
  renderTrips(state);
  renderTripsSummary(state);
}

function renderTrips(state) {
  const filteredTrips = getFilteredTrips(state);
  document.querySelector("[data-trip-count]").textContent =
    filteredTrips.length === state.trips.length ? `${state.trips.length} trips` : `${filteredTrips.length} of ${state.trips.length} trips`;

  document.querySelector("[data-admin-trips]").innerHTML = filteredTrips.length
    ? filteredTrips
      .map((trip) => `
          <article class="admin-trip-card">
            <img src="${escapeAttr(trip.image || "")}" alt="${escapeAttr(trip.title)}" loading="lazy" />
            <div class="admin-trip-card-body">
              <div class="trip-card-head">
                <span class="status-pill">${escapeHtml(trip.type || "Trip")}</span>
                ${statusPill(String(trip.status || "Planning").toLowerCase().replaceAll(" ", "-"))}
              </div>
              <h3>${escapeHtml(trip.title)}</h3>
              <p>${escapeHtml(trip.concierge || "No concierge plan added.")}</p>
              <div class="trip-facts">
                <span>${escapeHtml(trip.destination || "Destination pending")}</span>
                <span>${escapeHtml(trip.dates || "Dates pending")}</span>
                <span>${escapeHtml(trip.duration || "Duration pending")}</span>
                <span>${Number(trip.stays || 0)} stays</span>
              </div>
              <div class="admin-trip-footer">
                <div>
                  <strong>${escapeHtml(trip.guest || "Guest pending")}</strong>
                  <small>${escapeHtml(trip.manager || "Manager pending")}</small>
                </div>
                <div class="action-row">
                  <button class="pill-button" type="button" data-edit-trip="${trip.id}">Edit</button>
                  <button class="pill-button delete" type="button" data-delete-trip="${trip.id}">Delete</button>
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
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        <strong>No trips found</strong>
        <p>We couldn't find any trip plans matching your filter. Try adjusting your search query or plan a new trip.</p>
      </div>
    `;
}

function renderTripsSummary(state) {
  const tripRows = getFilteredTrips(state);
  const root = document.querySelector("[data-trip-summary]");
  if (!root) return;

  renderAdminSummary(root, [
    { label: "Visible trips", value: tripRows.length, icon: "trip", tone: "total" },
    { label: "Ready trips", value: tripRows.filter((trip) => trip.status === "Confirmed").length, icon: "active", tone: "approved" },
    { label: "Planning", value: tripRows.filter((trip) => trip.status === "Planning").length, icon: "pending", tone: "pending" }
  ]);
}

function getFilteredTrips(state) {
  const { search, status, type, sort } = filters.trips;
  const matched = state.trips.filter((trip) => {
    const haystack = [trip.title, trip.type, trip.guest, trip.destination, trip.dates, trip.status, trip.manager].join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = status === "all" || trip.status === status;
    const matchesType = type === "all" || (trip.type || "") === type;
    return matchesSearch && matchesStatus && matchesType;
  });
  return sortTrips(matched, sort);
}

function sortTrips(trips, sort) {
  return [...trips].sort((a, b) => {
    if (sort === "title-asc") return (a.title || "").localeCompare(b.title || "");
    if (sort === "stays-desc") return Number(b.stays || 0) - Number(a.stays || 0);
    if (sort === "status") return (a.status || "").localeCompare(b.status || "");
    return 0;
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
