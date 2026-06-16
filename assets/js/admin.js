import { clearCurrentUser, createId, findHotel, findUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, formatCurrency, initAuthChrome, initTheme, showToast, statusPill } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  bookings: { search: "", status: "all", payment: "all" },
  users: { search: "", role: "all" },
  hotels: { search: "" },
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
  initAdminTabs();
  initAdminForms();
  initFilters();
  initConfirmModal();
  renderAdminProfile();
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

    if (bookingAction === "delete") {
      showConfirm("Are you sure you want to delete this booking request?", () => {
        updateState((state) => {
          state.bookings = state.bookings.filter((item) => item.id !== bookingId);
        });
        renderAdmin();
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
    const hotelId = deleteButton.dataset.deleteHotel;
    showConfirm("Are you sure you want to remove this hotel? All bookings associated with it will also be deleted.", () => {
      updateState((state) => {
        state.hotels = state.hotels.filter((hotel) => hotel.id !== hotelId);
        state.bookings = state.bookings.filter((booking) => booking.hotelId !== hotelId);
      });
      renderAdmin();
      showToast("Hotel removed.");
    });
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
    const tripId = deleteButton.dataset.deleteTrip;
    showConfirm("Are you sure you want to remove this trip?", () => {
      updateState((state) => {
        state.trips = state.trips.filter((trip) => trip.id !== tripId);
      });
      renderAdmin();
      showToast("Trip removed.");
    });
  });
}

function renderAdmin() {
  const state = getState();
  renderMetrics(state);
  renderOverviewChart(state);
  renderOverviewLists(state);
  renderBookings(state);
  renderUsers(state);
  renderHotels(state);
  renderTrips(state);
}

function getBookingNights(booking) {
  if (!booking.checkIn || !booking.checkOut) return 1;
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  const diffTime = checkOut - checkIn;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

function renderAdminProfile() {
  const footer = document.querySelector("[data-admin-profile-footer]");
  if (!footer || !currentUser) return;
  const initials = currentUser.name.split(" ").map(w => w[0]).join("").toUpperCase();
  footer.innerHTML = `
    <div class="avatar-circle">${initials}</div>
    <div class="profile-details">
      <span class="profile-name">${currentUser.name}</span>
      <span class="profile-role">Administrator</span>
    </div>
  `;
}

function initFilters() {
  const bkSearch = document.querySelector("[data-filter-booking-search]");
  const bkStatus = document.querySelector("[data-filter-booking-status]");
  const bkPayment = document.querySelector("[data-filter-booking-payment]");

  if (bkSearch) bkSearch.addEventListener("input", (e) => {
    filters.bookings.search = e.target.value.toLowerCase().trim();
    renderBookings(getState());
  });
  if (bkStatus) bkStatus.addEventListener("change", (e) => {
    filters.bookings.status = e.target.value;
    renderBookings(getState());
  });
  if (bkPayment) bkPayment.addEventListener("change", (e) => {
    filters.bookings.payment = e.target.value;
    renderBookings(getState());
  });

  const usSearch = document.querySelector("[data-filter-user-search]");
  const usRole = document.querySelector("[data-filter-user-role]");

  if (usSearch) usSearch.addEventListener("input", (e) => {
    filters.users.search = e.target.value.toLowerCase().trim();
    renderUsers(getState());
  });
  if (usRole) usRole.addEventListener("change", (e) => {
    filters.users.role = e.target.value;
    renderUsers(getState());
  });

  const htSearch = document.querySelector("[data-filter-hotel-search]");
  if (htSearch) htSearch.addEventListener("input", (e) => {
    filters.hotels.search = e.target.value.toLowerCase().trim();
    renderHotels(getState());
  });

  const trSearch = document.querySelector("[data-filter-trip-search]");
  if (trSearch) trSearch.addEventListener("input", (e) => {
    filters.trips.search = e.target.value.toLowerCase().trim();
    renderTrips(getState());
  });
}

function initConfirmModal() {
  const overlay = document.querySelector("[data-confirm-overlay]");
  const cancelBtn = document.querySelector("[data-confirm-cancel]");
  const okBtn = document.querySelector("[data-confirm-ok]");

  if (!overlay) return;

  const closeConfirm = () => {
    overlay.classList.remove("open");
    currentConfirmAction = null;
  };

  cancelBtn.addEventListener("click", closeConfirm);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeConfirm();
  });

  okBtn.addEventListener("click", () => {
    if (typeof currentConfirmAction === "function") {
      currentConfirmAction();
    }
    closeConfirm();
  });
}

function showConfirm(message, onConfirm) {
  const overlay = document.querySelector("[data-confirm-overlay]");
  const msgEl = document.querySelector("[data-confirm-message]");
  if (!overlay) {
    if (window.confirm(message)) onConfirm();
    return;
  }
  msgEl.textContent = message;
  currentConfirmAction = onConfirm;
  overlay.classList.add("open");
}

function renderOverviewChart(state) {
  const chartContainer = document.querySelector("[data-admin-chart]");
  if (!chartContainer) return;

  const data = state.hotels.map(hotel => {
    const revenue = state.bookings.reduce((sum, b) => {
      if (b.hotelId === hotel.id && b.payment === "paid") {
        const nights = getBookingNights(b);
        return sum + (hotel.price * nights);
      }
      return sum;
    }, 0);
    const shortName = hotel.name
      .replace(" Resort", "")
      .replace(" Hotel", "")
      .replace(" Retreat", "")
      .replace(" Suites", "")
      .replace(" House", "")
      .replace(" Residence", "");
    return { name: shortName, revenue };
  });

  const maxRevenue = Math.max(...data.map(d => d.revenue), 500);
  const chartHeight = 150;
  const chartWidth = 700;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const graphHeight = chartHeight - paddingTop - paddingBottom;
  const graphWidth = chartWidth - paddingLeft - paddingRight;

  const barWidth = 40;
  const spacing = graphWidth / data.length;

  let gridLines = "";
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + graphHeight - (graphHeight * (i / 4));
    const val = Math.round((maxRevenue * (i / 4)));
    gridLines += `
      <line x1="${paddingLeft}" y1="${y}" x2="${chartWidth - paddingRight}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4,4" />
      <text x="${paddingLeft - 10}" y="${y + 4}" fill="var(--muted)" font-size="10" text-anchor="end" font-weight="700">$${val}</text>
    `;
  }

  const bars = data.map((d, index) => {
    const x = paddingLeft + (index * spacing) + (spacing - barWidth) / 2;
    const barHeight = maxRevenue > 0 ? (d.revenue / maxRevenue) * graphHeight : 0;
    const y = paddingTop + graphHeight - barHeight;

    return `
      <g class="chart-bar-group">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="url(#chart-grad)" rx="4" ry="4" class="chart-bar" style="transform-origin: ${x + barWidth/2}px ${paddingTop + graphHeight}px; transform: scaleY(0); animation: drawBar 1s cubic-bezier(0.4, 0, 0.2, 1) forwards; animation-delay: ${index * 100}ms;" />
        <text x="${x + barWidth / 2}" y="${y - 6}" fill="var(--primary-dark)" font-size="11" font-weight="800" text-anchor="middle" class="chart-val">$${d.revenue}</text>
        <text x="${x + barWidth / 2}" y="${chartHeight - 10}" fill="var(--muted)" font-size="10" font-weight="700" text-anchor="middle">${d.name}</text>
      </g>
    `;
  }).join("");

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--primary)" />
          <stop offset="100%" stop-color="var(--primary-soft)" stop-opacity="0.2" />
        </linearGradient>
        <style>
          @keyframes drawBar {
            to { transform: scaleY(1); }
          }
          .chart-bar-group:hover rect {
            fill: var(--accent);
            filter: drop-shadow(0 4px 8px rgba(184, 91, 60, 0.25));
          }
          .chart-bar-group:hover text.chart-val {
            fill: var(--accent);
            font-size: 12px;
          }
          .chart-bar {
            transition: fill 200ms ease, filter 200ms ease;
          }
        </style>
      </defs>
      ${gridLines}
      ${bars}
    </svg>
  `;
}

function renderMetrics(state) {
  const pending = state.bookings.filter((booking) => booking.status === "pending").length;
  const approved = state.bookings.filter((booking) => booking.status === "approved").length;
  const revenue = state.bookings.reduce((total, booking) => {
    const hotel = findHotel(state, booking.hotelId);
    if (booking.payment === "paid" && hotel) {
      const nights = getBookingNights(booking);
      return total + (Number(hotel.price) * nights);
    }
    return total;
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
          const totalCost = hotel ? hotel.price * getBookingNights(booking) : 0;
          return `
            <article class="compact-item">
              <h3>${user?.name || "Unknown guest"}</h3>
              <p>${hotel?.name || "Hotel removed"} (${formatCurrency(totalCost)})</p>
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
  const totalCost = hotel ? hotel.price * getBookingNights(booking) : 0;
  return `
    <article class="compact-item">
      <h3>${hotel?.name || "Hotel removed"}</h3>
      <p>${user?.name || "Unknown guest"} / ${booking.checkIn} to ${booking.checkOut} (${formatCurrency(totalCost)})</p>
      <div class="action-row">
        ${statusPill(booking.status)}
        ${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}
      </div>
    </article>
  `;
}

function renderBookings(state) {
  const search = filters.bookings.search;
  const status = filters.bookings.status;
  const payment = filters.bookings.payment;

  const filteredBookings = state.bookings.filter((booking) => {
    const hotel = findHotel(state, booking.hotelId);
    const user = findUser(state, booking.userId);

    const matchesSearch = !search ||
      (user?.name && user.name.toLowerCase().includes(search)) ||
      (user?.email && user.email.toLowerCase().includes(search)) ||
      (hotel?.name && hotel.name.toLowerCase().includes(search)) ||
      booking.roomType.toLowerCase().includes(search);

    const matchesStatus = status === "all" || booking.status === status;
    const matchesPayment = payment === "all" || booking.payment === payment;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  const rows = filteredBookings
    .map((booking) => {
      const hotel = findHotel(state, booking.hotelId);
      const user = findUser(state, booking.userId);
      const nights = getBookingNights(booking);
      const totalCost = hotel ? hotel.price * nights : 0;
      return `
        <tr>
          <td><strong>${user?.name || "Unknown guest"}</strong><br>${user?.email || ""}</td>
          <td>
            <strong>${hotel?.name || "Hotel removed"}</strong><br>${booking.roomType}<br>${booking.guests} guest(s)
            ${hotel ? `<div style="margin-top: 4px; font-size: 12px; color: var(--muted);">${formatCurrency(hotel.price)} × ${nights} night${nights === 1 ? "" : "s"} = <strong>${formatCurrency(totalCost)}</strong></div>` : ""}
          </td>
          <td>${booking.checkIn}<br>${booking.checkOut}</td>
          <td>${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}</td>
          <td>${statusPill(booking.status)}</td>
          <td>
            <div class="action-row">
              <button class="pill-button approve" type="button" data-booking-id="${booking.id}" data-booking-action="approve" ${booking.status === "approved" ? "disabled" : ""}>Approve</button>
              <button class="pill-button reject" type="button" data-booking-id="${booking.id}" data-booking-action="reject" ${booking.status === "rejected" ? "disabled" : ""}>Reject</button>
              <button class="pill-button" type="button" data-booking-id="${booking.id}" data-booking-action="paid" ${booking.payment === "paid" ? "disabled" : ""}>Mark paid</button>
              <button class="pill-button delete" type="button" data-booking-id="${booking.id}" data-booking-action="delete">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelector("[data-bookings-table]").innerHTML = rows || `<tr><td colspan="6">No booking requests found.</td></tr>`;
}

function renderUsers(state) {
  const search = filters.users.search;
  const role = filters.users.role;

  const filteredUsers = state.users.filter((user) => {
    const matchesSearch = !search ||
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      (user.phone && user.phone.toLowerCase().includes(search));

    const matchesRole = role === "all" || user.role === role;

    return matchesSearch && matchesRole;
  });

  document.querySelector("[data-users-table]").innerHTML = filteredUsers
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
  const search = filters.hotels.search;

  const filteredHotels = state.hotels.filter((hotel) => {
    return !search ||
      hotel.name.toLowerCase().includes(search) ||
      hotel.city.toLowerCase().includes(search);
  });

  const hotelCountText = filteredHotels.length === state.hotels.length
    ? `${state.hotels.length} hotels`
    : `${filteredHotels.length} of ${state.hotels.length} hotels`;

  document.querySelector("[data-hotel-count]").textContent = hotelCountText;
  document.querySelector("[data-admin-hotels]").innerHTML = filteredHotels
    .map(
      (hotel) => `
        <article class="compact-item">
          <h3>${hotel.name}</h3>
          <p>${hotel.city} / ${formatCurrency(hotel.price)} per night / ${hotel.rooms} rooms</p>
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
  const search = filters.trips.search;

  const filteredTrips = state.trips.filter((trip) => {
    return !search ||
      trip.title.toLowerCase().includes(search) ||
      trip.guest.toLowerCase().includes(search) ||
      trip.destination.toLowerCase().includes(search);
  });

  const tripCountText = filteredTrips.length === state.trips.length
    ? `${state.trips.length} trips`
    : `${filteredTrips.length} of ${state.trips.length} trips`;

  document.querySelector("[data-trip-count]").textContent = tripCountText;
  document.querySelector("[data-admin-trips]").innerHTML = filteredTrips
    .map(
      (trip) => `
        <article class="compact-item">
          <h3>${trip.title}</h3>
          <p>${trip.guest} / ${trip.destination} / ${trip.dates}</p>
          <div class="action-row">
            ${statusPill(trip.status.toLowerCase().replaceAll(" ", "-"))}
            <button class="pill-button delete" type="button" data-delete-trip="${trip.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
}
