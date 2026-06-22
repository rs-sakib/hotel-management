import { clearCurrentUser, findHotel, findUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, formatCurrency, initAuthChrome, initTheme, showToast, statusPill, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  bookings: { search: "", status: "all", payment: "all" }
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
  renderBookingsPage();
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
  document.querySelector("[data-bookings-table]").addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-booking-action]");
    if (!actionButton) return;
    const { bookingId, bookingAction } = actionButton.dataset;

    if (bookingAction === "delete") {
      showConfirm("Delete this booking request?", () => {
        updateState((state) => {
          state.bookings = state.bookings.filter((item) => item.id !== bookingId);
        });
        renderBookingsPage();
        showToast("Booking request deleted.");
      });
      return;
    }

    updateState((state) => {
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) return;
      if (bookingAction === "approve") booking.status = "approved";
      if (bookingAction === "reject") booking.status = "rejected";
      if (bookingAction === "paid") booking.payment = "paid";
    });

    renderBookingsPage();
    showToast("Booking updated.");
  });
}

function initFilters() {
  bindFilter("[data-filter-booking-search]", "input", (event) => {
    filters.bookings.search = event.target.value.toLowerCase().trim();
    renderBookingsPage();
  });
  bindFilter("[data-filter-booking-status]", "change", (event) => {
    filters.bookings.status = event.target.value;
    renderBookingsPage();
  });
  bindFilter("[data-filter-booking-payment]", "change", (event) => {
    filters.bookings.payment = event.target.value;
    renderBookingsPage();
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

function renderBookingsPage() {
  const state = getState();
  renderBookings(state);
  renderBookingsSummary(state);
}

function renderBookings(state) {
  const filteredBookings = getFilteredBookings(state);
  document.querySelector("[data-bookings-table]").innerHTML = filteredBookings.length
    ? filteredBookings
      .map((booking) => {
        const hotel = findHotel(state, booking.hotelId);
        const user = findUser(state, booking.userId);
        const nights = getBookingNights(booking);
        const totalCost = hotel ? Number(hotel.price || 0) * nights : 0;
        return `
            <tr>
              <td><strong>${escapeHtml(user?.name || "Unknown guest")}</strong><br>${escapeHtml(user?.email || "")}</td>
              <td>
                <strong>${escapeHtml(hotel?.name || "Hotel removed")}</strong><br>
                ${escapeHtml(booking.roomType)} / ${Number(booking.guests)} guest(s)<br>
                <small>${hotel ? `${formatCurrency(hotel.price)} x ${nights} night${nights === 1 ? "" : "s"} = ${formatCurrency(totalCost)}` : ""}</small>
              </td>
              <td>${escapeHtml(booking.checkIn)}<br>${escapeHtml(booking.checkOut)}</td>
              <td>${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}</td>
              <td>${statusPill(booking.status)}</td>
              <td>
                <div class="action-row">
                  <button class="pill-button approve" type="button" data-booking-id="${booking.id}" data-booking-action="approve" ${booking.status === "approved" ? "disabled" : ""}>Approve</button>
                  <button class="pill-button reject" type="button" data-booking-id="${booking.id}" data-booking-action="reject" ${booking.status === "rejected" ? "disabled" : ""}>Reject</button>
                  <button class="pill-button" type="button" data-booking-id="${booking.id}" data-booking-action="paid" ${booking.payment === "paid" ? "disabled" : ""}>Paid</button>
                  <button class="pill-button delete" type="button" data-booking-id="${booking.id}" data-booking-action="delete">Delete</button>
                </div>
              </td>
            </tr>
          `;
      })
      .join("")
    : `<tr><td colspan="6">No booking requests found.</td></tr>`;
}

function renderBookingsSummary(state) {
  const bookingRows = getFilteredBookings(state);
  const root = document.querySelector("[data-booking-summary]");
  if (!root) return;

  const items = [
    ["Visible bookings", bookingRows.length],
    ["Pending", bookingRows.filter((booking) => booking.status === "pending").length],
    ["Paid", bookingRows.filter((booking) => booking.payment === "paid").length],
    ["Revenue", formatCurrency(getBookingsRevenue(state, bookingRows))]
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

function getFilteredBookings(state) {
  return state.bookings.filter((booking) => {
    const hotel = findHotel(state, booking.hotelId);
    const user = findUser(state, booking.userId);
    const search = filters.bookings.search;
    const matchesSearch =
      !search ||
      user?.name?.toLowerCase().includes(search) ||
      user?.email?.toLowerCase().includes(search) ||
      hotel?.name?.toLowerCase().includes(search) ||
      booking.roomType.toLowerCase().includes(search);
    return matchesSearch && (filters.bookings.status === "all" || booking.status === filters.bookings.status) && (filters.bookings.payment === "all" || booking.payment === filters.bookings.payment);
  });
}

function getBookingsRevenue(state, bookings) {
  return bookings.reduce((total, booking) => {
    const hotel = findHotel(state, booking.hotelId);
    if (!hotel || booking.payment !== "paid") return total;
    return total + Number(hotel.price || 0) * getBookingNights(booking);
  }, 0);
}

function getBookingNights(booking) {
  if (!booking.checkIn || !booking.checkOut) return 1;
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  const diffDays = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays || 1);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
