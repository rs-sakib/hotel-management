import { findHotel, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, formatCurrency, formatStatus, initAuthChrome, initHeader, initTheme, showToast, statusPill } from "./ui.js";

const currentUser = getCurrentUser();

initTheme();
initHeader();
initAuthChrome();
animatePage();

if (!currentUser) {
  window.location.href = "login.html";
} else if (isAdminUser(currentUser)) {
  window.location.href = "admin.html";
} else {
  renderDashboard();
  initDashboardActions();
}

function renderDashboard() {
  const state = getState();
  const bookings = state.bookings.filter((booking) => booking.userId === currentUser.id);
  const paid = bookings.filter((booking) => booking.payment === "paid").length;
  const approved = bookings.filter((booking) => booking.status === "approved").length;
  const pending = bookings.filter((booking) => booking.status === "pending").length;

  document.querySelector("[data-dashboard-name]").textContent = `Welcome back, ${currentUser.name}.`;
  document.querySelector("[data-dashboard-subtitle]").textContent = `${bookings.length} booking request${bookings.length === 1 ? "" : "s"} connected to your account.`;

  document.querySelector("[data-dashboard-metrics]").innerHTML = [
    ["Total bookings", bookings.length, "All requests"],
    ["Approved", approved, "Confirmed stays"],
    ["Pending", pending, "Waiting for review"],
    ["Paid", paid, "Payment completed"]
  ]
    .map(
      ([label, value, detail]) => `
        <article class="stat-card">
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${detail}</small>
        </article>
      `
    )
    .join("");

  document.querySelector("[data-user-profile]").innerHTML = `
    <div class="profile-row">
      <span>Name</span>
      <strong>${currentUser.name}</strong>
    </div>
    <div class="profile-row">
      <span>Email</span>
      <strong>${currentUser.email}</strong>
    </div>
    <div class="profile-row">
      <span>Phone</span>
      <strong>${currentUser.phone}</strong>
    </div>
    <div class="profile-row">
      <span>Role</span>
      ${statusPill("guest")}
    </div>
  `;

  document.querySelector("[data-user-bookings]").innerHTML = bookings.length
    ? bookings.map((booking) => renderBookingCard(state, booking)).join("")
    : `<div class="empty-state">No bookings yet. Choose a hotel and send your first request.</div>`;
}

function renderBookingCard(state, booking) {
  const hotel = findHotel(state, booking.hotelId);
  const paymentAction =
    booking.payment === "pending"
      ? `<button class="primary-button compact" type="button" data-dashboard-pay="${booking.id}">Pay now</button>`
      : `<span class="status-pill paid">Paid</span>`;

  return `
    <article class="user-booking-card">
      <div>
        <h3>${hotel?.name || "Hotel removed"}</h3>
        <p>${booking.checkIn} to ${booking.checkOut} / ${booking.guests} guest(s) / ${booking.roomType}</p>
        <small>${hotel ? `${hotel.city} / ${formatCurrency(hotel.price)} per night` : "Property unavailable"}</small>
      </div>
      <div class="action-row">
        ${statusPill(booking.status)}
        <span class="status-pill ${booking.payment === "paid" ? "paid" : "unpaid"}">${formatStatus(booking.payment)}</span>
        ${paymentAction}
      </div>
    </article>
  `;
}

function initDashboardActions() {
  document.querySelector("[data-user-bookings]").addEventListener("click", (event) => {
    const payButton = event.target.closest("[data-dashboard-pay]");
    if (!payButton) return;

    updateState((state) => {
      const booking = state.bookings.find((item) => item.id === payButton.dataset.dashboardPay);
      if (booking && booking.userId === currentUser.id) {
        booking.payment = "paid";
      }
    });

    renderDashboard();
    showToast("Payment recorded for this booking.");
  });
}
