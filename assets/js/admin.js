import { clearCurrentUser, createId, findHotel, findUser, getCurrentUser, getState, updateState } from "./store.js";
import { animatePage, formatCurrency, initAuthChrome, initTheme, showToast, statusPill } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

initTheme();
initAuthChrome();
initCustomControls();
animatePage();

if (!currentUser || currentUser.role !== "admin") {
  accessWarning.hidden = false;
  adminContent.hidden = true;
} else {
  initAdminTabs();
  initAdminForms();
  renderAdmin();
}

document.querySelector("[data-logout]").addEventListener("click", () => {
  clearCurrentUser();
  window.location.href = "login.html";
});

function initAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll("[data-admin-section]").forEach((section) => section.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`[data-admin-section="${button.dataset.adminTab}"]`).classList.add("active");

      if (window.gsap) {
        window.gsap.from(`[data-admin-section="${button.dataset.adminTab}"]`, { y: 16, opacity: 0, duration: 0.32, ease: "power2.out" });
      }
    });
  });
}

function initAdminForms() {
  document.querySelector("[data-bookings-table]").addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-booking-action]");
    if (!actionButton) return;
    const { bookingId, bookingAction } = actionButton.dataset;

    updateState((state) => {
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) return;
      if (bookingAction === "approve") booking.status = "approved";
      if (bookingAction === "reject") booking.status = "rejected";
      if (bookingAction === "paid") booking.payment = "paid";
      if (bookingAction === "delete") state.bookings = state.bookings.filter((item) => item.id !== bookingId);
    });

    renderAdmin();
    showToast("Booking updated.");
  });

  document.querySelector("[data-hotel-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateState((state) => {
      state.hotels.unshift({
        id: createId("h"),
        name: String(formData.get("name")).trim(),
        city: String(formData.get("city")).trim(),
        rating: 4.7,
        price: Number(formData.get("price")),
        rooms: Number(formData.get("rooms")),
        image: String(formData.get("image")).trim(),
        amenities: String(formData.get("amenities"))
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        description: "A newly added property managed through the AzureStay admin dashboard."
      });
    });
    event.currentTarget.reset();
    renderAdmin();
    showToast("Hotel added to the portfolio.");
  });

  document.querySelector("[data-admin-hotels]").addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-hotel]");
    if (!deleteButton) return;
    updateState((state) => {
      state.hotels = state.hotels.filter((hotel) => hotel.id !== deleteButton.dataset.deleteHotel);
      state.bookings = state.bookings.filter((booking) => booking.hotelId !== deleteButton.dataset.deleteHotel);
    });
    renderAdmin();
    showToast("Hotel removed.");
  });

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
    renderAdmin();
    showToast("Trip added.");
  });

  document.querySelector("[data-admin-trips]").addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-trip]");
    if (!deleteButton) return;
    updateState((state) => {
      state.trips = state.trips.filter((trip) => trip.id !== deleteButton.dataset.deleteTrip);
    });
    renderAdmin();
    showToast("Trip removed.");
  });
}

function renderAdmin() {
  const state = getState();
  renderMetrics(state);
  renderOverviewLists(state);
  renderBookings(state);
  renderUsers(state);
  renderHotels(state);
  renderTrips(state);
}

function renderMetrics(state) {
  const pending = state.bookings.filter((booking) => booking.status === "pending").length;
  const approved = state.bookings.filter((booking) => booking.status === "approved").length;
  const revenue = state.bookings.reduce((total, booking) => {
    const hotel = findHotel(state, booking.hotelId);
    return booking.payment === "paid" && hotel ? total + Number(hotel.price) : total;
  }, 0);

  document.querySelector("[data-admin-metrics]").innerHTML = [
    ["Users", state.users.length, "Registered accounts"],
    ["Hotels", state.hotels.length, "Properties managed"],
    ["Pending", pending, "Bookings to review"],
    ["Revenue", formatCurrency(revenue), `${approved} approved stays`]
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
}

function renderOverviewLists(state) {
  const recentBookings = state.bookings.slice(0, 4);
  const pending = state.bookings.filter((booking) => booking.status === "pending").length;
  document.querySelector("[data-pending-count]").textContent = `${pending} pending`;

  document.querySelector("[data-recent-bookings]").innerHTML = recentBookings.length
    ? recentBookings.map((booking) => compactBookingItem(state, booking)).join("")
    : `<div class="empty-state">No bookings yet.</div>`;

  document.querySelector("[data-payment-monitor]").innerHTML = state.bookings.length
    ? state.bookings
        .slice(0, 4)
        .map((booking) => {
          const hotel = findHotel(state, booking.hotelId);
          const user = findUser(state, booking.userId);
          return `
            <article class="compact-item">
              <h3>${user?.name || "Unknown guest"}</h3>
              <p>${hotel?.name || "Hotel removed"}</p>
              ${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">No payments yet.</div>`;
}

function compactBookingItem(state, booking) {
  const hotel = findHotel(state, booking.hotelId);
  const user = findUser(state, booking.userId);
  return `
    <article class="compact-item">
      <h3>${hotel?.name || "Hotel removed"}</h3>
      <p>${user?.name || "Unknown guest"} • ${booking.checkIn} to ${booking.checkOut}</p>
      <div class="action-row">
        ${statusPill(booking.status)}
        ${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}
      </div>
    </article>
  `;
}

function renderBookings(state) {
  const rows = state.bookings
    .map((booking) => {
      const hotel = findHotel(state, booking.hotelId);
      const user = findUser(state, booking.userId);
      return `
        <tr>
          <td><strong>${user?.name || "Unknown guest"}</strong><br>${user?.email || ""}</td>
          <td><strong>${hotel?.name || "Hotel removed"}</strong><br>${booking.roomType}<br>${booking.guests} guest(s)</td>
          <td>${booking.checkIn}<br>${booking.checkOut}</td>
          <td>${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}</td>
          <td>${statusPill(booking.status)}</td>
          <td>
            <div class="action-row">
              <button class="pill-button approve" type="button" data-booking-id="${booking.id}" data-booking-action="approve">Approve</button>
              <button class="pill-button reject" type="button" data-booking-id="${booking.id}" data-booking-action="reject">Reject</button>
              <button class="pill-button" type="button" data-booking-id="${booking.id}" data-booking-action="paid">Mark paid</button>
              <button class="pill-button delete" type="button" data-booking-id="${booking.id}" data-booking-action="delete">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelector("[data-bookings-table]").innerHTML = rows || `<tr><td colspan="6">No booking requests yet.</td></tr>`;
}

function renderUsers(state) {
  document.querySelector("[data-users-table]").innerHTML = state.users
    .map(
      (user) => `
        <tr>
          <td><strong>${user.name}</strong></td>
          <td>${user.email}</td>
          <td>${user.phone}</td>
          <td>${user.role}</td>
          <td>${user.status}</td>
        </tr>
      `
    )
    .join("");
}

function renderHotels(state) {
  document.querySelector("[data-hotel-count]").textContent = `${state.hotels.length} hotels`;
  document.querySelector("[data-admin-hotels]").innerHTML = state.hotels
    .map(
      (hotel) => `
        <article class="compact-item">
          <h3>${hotel.name}</h3>
          <p>${hotel.city} • ${formatCurrency(hotel.price)} / night • ${hotel.rooms} rooms</p>
          <div class="action-row">
            ${hotel.amenities.slice(0, 3).map((amenity) => `<span class="status-pill">${amenity}</span>`).join("")}
            <button class="pill-button delete" type="button" data-delete-hotel="${hotel.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTrips(state) {
  document.querySelector("[data-trip-count]").textContent = `${state.trips.length} trips`;
  document.querySelector("[data-admin-trips]").innerHTML = state.trips
    .map(
      (trip) => `
        <article class="compact-item">
          <h3>${trip.title}</h3>
          <p>${trip.guest} • ${trip.destination} • ${trip.dates}</p>
          <div class="action-row">
            ${statusPill(trip.status.toLowerCase().replaceAll(" ", "-"))}
            <button class="pill-button delete" type="button" data-delete-trip="${trip.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
}
