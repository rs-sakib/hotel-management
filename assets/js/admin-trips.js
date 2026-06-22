import { clearCurrentUser, createId, findUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, initAuthChrome, initTheme, showToast, statusPill, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  trips: { search: "" }
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
  document.querySelector("[data-trip-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateState((state) => {
      state.trips.unshift({
        id: createId("t"),
        title: String(formData.get("title")).trim(),
        guest: String(formData.get("guest")).trim(),
        destination: String(formData.get("destination")).trim(),
        dates: String(formData.get("dates")).trim(),
        status: String(formData.get("status"))
      });
    });
    event.currentTarget.reset();
    renderTripsPage();
    showToast("Trip added.");
  });

  document.querySelector("[data-admin-trips]").addEventListener("click", (event) => {
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

  document.querySelector("[data-admin-trip-bookings]").addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-trip-booking-action]");
    if (!actionButton) return;
    const { tripBookingId, tripBookingAction } = actionButton.dataset;

    if (tripBookingAction === "delete") {
      showConfirm("Delete this trip request?", () => {
        updateState((state) => {
          state.tripBookings = (state.tripBookings || []).filter((item) => item.id !== tripBookingId);
        });
        renderTripsPage();
        showToast("Trip request deleted.");
      });
      return;
    }

    updateState((state) => {
      const request = (state.tripBookings || []).find((item) => item.id === tripBookingId);
      if (!request) return;
      if (tripBookingAction === "approve") request.status = "approved";
      if (tripBookingAction === "reject") request.status = "rejected";
      if (tripBookingAction === "paid") request.payment = "paid";
    });

    renderTripsPage();
    showToast("Trip request updated.");
  });
}

function initFilters() {
  bindFilter("[data-filter-trip-search]", "input", (event) => {
    filters.trips.search = event.target.value.toLowerCase().trim();
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
  renderTripBookings(state);
  renderTripsSummary(state);
}

function renderTrips(state) {
  const filteredTrips = getFilteredTrips(state);
  document.querySelector("[data-trip-count]").textContent =
    filteredTrips.length === state.trips.length ? `${state.trips.length} trips` : `${filteredTrips.length} of ${state.trips.length} trips`;

  document.querySelector("[data-admin-trips]").innerHTML = filteredTrips.length
    ? filteredTrips
      .map((trip) => `
          <article class="compact-item">
            <h3>${escapeHtml(trip.title)}</h3>
            <p>${escapeHtml(trip.guest)} / ${escapeHtml(trip.destination)} / ${escapeHtml(trip.dates)}</p>
            <div class="action-row">
              ${statusPill(trip.status.toLowerCase().replaceAll(" ", "-"))}
              <button class="pill-button delete" type="button" data-delete-trip="${trip.id}">Delete</button>
            </div>
          </article>
        `)
      .join("")
    : `<div class="empty-state">No trips found.</div>`;
}

function renderTripBookings(state) {
  const requests = state.tripBookings || [];
  const countLabel = document.querySelector("[data-trip-request-count]");
  const list = document.querySelector("[data-admin-trip-bookings]");
  if (!countLabel || !list) return;

  countLabel.textContent = `${requests.length} request${requests.length === 1 ? "" : "s"}`;
  list.innerHTML = requests.length
    ? requests
      .map((request) => {
        const user = findUser(state, request.userId);
        return `
            <article class="compact-item">
              <h3>${escapeHtml(request.tripTitle || "Trip request")}</h3>
              <p>${escapeHtml(user?.name || "Unknown user")} / ${escapeHtml(request.destination || "Destination pending")} / ${Number(request.travelers || 1)} traveler(s)</p>
              <p>
                ${escapeHtml(request.packageType || "Standard plan")} / ${escapeHtml(request.preferredDate || "Date pending")} / ${escapeHtml(request.paymentMethod || "Payment method pending")}
                ${request.transactionId ? `<br><span style="color: var(--primary-dark); font-weight: 800; font-size: 0.74rem;">Txn ID: ${escapeHtml(request.transactionId)}</span>` : ""}
              </p>
              <div class="action-row">
                ${statusPill(request.status || "pending")}
                ${statusPill(request.payment === "paid" ? "paid" : "unpaid")}
                <button class="pill-button approve" type="button" data-trip-booking-id="${request.id}" data-trip-booking-action="approve" ${request.status === "approved" ? "disabled" : ""}>Approve</button>
                <button class="pill-button reject" type="button" data-trip-booking-id="${request.id}" data-trip-booking-action="reject" ${request.status === "rejected" ? "disabled" : ""}>Reject</button>
                <button class="pill-button" type="button" data-trip-booking-id="${request.id}" data-trip-booking-action="paid" ${request.payment === "paid" ? "disabled" : ""}>Paid</button>
                <button class="pill-button delete" type="button" data-trip-booking-id="${request.id}" data-trip-booking-action="delete">Delete</button>
              </div>
            </article>
          `;
      })
      .join("")
    : `<div class="empty-state">No trip requests yet.</div>`;
}

function renderTripsSummary(state) {
  const tripRows = getFilteredTrips(state);
  const root = document.querySelector("[data-trip-summary]");
  if (!root) return;

  const items = [
    ["Visible trips", tripRows.length],
    ["Confirmed", tripRows.filter((trip) => trip.status === "Confirmed").length],
    ["Planning", tripRows.filter((trip) => trip.status === "Planning").length],
    ["Requests", (state.tripBookings || []).length]
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

function getFilteredTrips(state) {
  return state.trips.filter((trip) => {
    const search = filters.trips.search;
    return !search || trip.title.toLowerCase().includes(search) || trip.guest.toLowerCase().includes(search) || trip.destination.toLowerCase().includes(search);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
