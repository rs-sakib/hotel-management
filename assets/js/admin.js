import { clearCurrentUser, createId, findHotel, findUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { loadHotelCatalog } from "./hotel-catalog.js";
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
  await hydrateHotelCatalog();
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

function initAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll("[data-admin-section]").forEach((section) => section.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`[data-admin-section="${button.dataset.adminTab}"]`).classList.add("active");
    });
  });
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
    renderAdmin();
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
    showConfirm("Remove this trip?", () => {
      updateState((state) => {
        state.trips = state.trips.filter((trip) => trip.id !== tripId);
      });
      renderAdmin();
      showToast("Trip removed.");
    });
  });
}

function initFilters() {
  bindFilter("[data-filter-booking-search]", "input", (event) => {
    filters.bookings.search = event.target.value.toLowerCase().trim();
    renderBookings(getState());
    renderSectionSummaries(getState());
  });
  bindFilter("[data-filter-booking-status]", "change", (event) => {
    filters.bookings.status = event.target.value;
    renderBookings(getState());
    renderSectionSummaries(getState());
  });
  bindFilter("[data-filter-booking-payment]", "change", (event) => {
    filters.bookings.payment = event.target.value;
    renderBookings(getState());
    renderSectionSummaries(getState());
  });
  bindFilter("[data-filter-user-search]", "input", (event) => {
    filters.users.search = event.target.value.toLowerCase().trim();
    renderUsers(getState());
    renderSectionSummaries(getState());
  });
  bindFilter("[data-filter-user-role]", "change", (event) => {
    filters.users.role = event.target.value;
    renderUsers(getState());
    renderSectionSummaries(getState());
  });
  bindFilter("[data-filter-hotel-search]", "input", (event) => {
    filters.hotels.search = event.target.value.toLowerCase().trim();
    renderHotels(getState());
    renderSectionSummaries(getState());
  });
  bindFilter("[data-filter-trip-search]", "input", (event) => {
    filters.trips.search = event.target.value.toLowerCase().trim();
    renderTrips(getState());
    renderSectionSummaries(getState());
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

function renderAdmin() {
  const state = getState();
  renderMetrics(state);
  renderOverviewCharts(state);
  renderOverviewLists(state);
  renderSectionSummaries(state);
  renderBookings(state);
  renderUsers(state);
  renderHotels(state);
  renderTrips(state);
}

function renderAdminProfile() {
  const footer = document.querySelector("[data-admin-profile-footer]");
  if (!footer || !currentUser) return;
  const initials = currentUser.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  footer.innerHTML = `
    <div class="avatar-circle">${escapeHtml(initials)}</div>
    <div class="profile-details">
      <span class="profile-name">${escapeHtml(currentUser.name)}</span>
      <span class="profile-role">${escapeHtml(currentUser.role)}</span>
    </div>
  `;
}

function renderMetrics(state) {
  const analysis = analyzeState(state);
  document.querySelector("[data-admin-metrics]").innerHTML = [
    ["Portfolio", state.hotels.length, `${analysis.cityCount} active locations`, "total", buildingIcon()],
    ["Bookings", state.bookings.length, `${analysis.pending} pending review`, "pending", calendarIcon()],
    ["Paid revenue", formatCurrency(analysis.paidRevenue), `${analysis.paidBookings} paid bookings`, "paid", dollarIcon()],
    ["Open rooms", analysis.totalRooms, `${analysis.averageRating.toFixed(1)} average rating`, "approved", roomIcon()]
  ]
    .map(
      ([label, value, detail, type, icon]) => `
        <article class="metric-card ${type}">
          <div class="metric-info">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(detail)}</small>
          </div>
          <div class="metric-icon">${icon}</div>
        </article>
      `
    )
    .join("");
}

function renderOverviewCharts(state) {
  const analysis = analyzeState(state);
  document.querySelector("[data-admin-revenue-total]").textContent = formatCurrency(analysis.paidRevenue);
  document.querySelector("[data-admin-booking-total]").textContent = `${state.bookings.length} total`;
  document.querySelector("[data-city-total]").textContent = `${analysis.cityCount} cities`;
  document.querySelector("[data-room-total]").textContent = `${analysis.totalRooms} rooms`;

  renderRevenueChart(state);
  renderStatusChart(analysis);
  renderCityChart(state);
  renderRoomChart(state);
}

function renderRevenueChart(state) {
  const chartContainer = document.querySelector("[data-admin-chart]");
  if (!chartContainer) return;
  const revenueByHotel = state.hotels
    .map((hotel) => ({
      label: shortenHotelName(hotel.name),
      value: state.bookings.reduce((sum, booking) => {
        if (booking.hotelId !== hotel.id || booking.payment !== "paid") return sum;
        return sum + Number(hotel.price || 0) * getBookingNights(booking);
      }, 0)
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const fallback = state.hotels
    .slice()
    .sort((a, b) => b.rooms - a.rooms)
    .slice(0, 8)
    .map((hotel) => ({ label: shortenHotelName(hotel.name), value: Number(hotel.rooms || 0), suffix: " rooms" }));

  const data = revenueByHotel.length ? revenueByHotel : fallback;
  if (!data.length) {
    chartContainer.innerHTML = `<div class="empty-state">No revenue data available.</div>`;
    return;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 100);
  
  // Dimensions
  const width = 700;
  const height = 220;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 25;
  const paddingBottom = 40;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  
  // Calculate points
  const points = data.map((item, index) => {
    const x = paddingLeft + (index * (plotWidth / Math.max(1, data.length - 1)));
    const y = paddingTop + plotHeight - (item.value / maxValue) * plotHeight;
    return { x, y, label: item.label, value: item.value, suffix: item.suffix };
  });

  // Grid lines
  let gridHtml = "";
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = paddingTop + plotHeight - (plotHeight * (i / gridSteps));
    const val = Math.round((maxValue * (i / gridSteps)));
    const displayVal = data[0].suffix ? `${val}${data[0].suffix}` : `$${val}`;
    gridHtml += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4,4" />
      <text x="${paddingLeft - 10}" y="${y + 4}" fill="var(--muted)" font-size="10" font-weight="800" text-anchor="end">${displayVal}</text>
    `;
  }

  // Draw line path and area path
  let linePathD = "";
  let areaPathD = "";
  
  if (points.length > 0) {
    linePathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    areaPathD = `M ${points[0].x} ${paddingTop + plotHeight} L ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${points[points.length - 1].x} ${paddingTop + plotHeight} Z`;
  }

  // Draw dots and value labels
  const interactiveElements = points.map((p, index) => {
    const displayVal = p.suffix ? `${p.value}${p.suffix}` : formatCurrency(p.value);
    return `
      <g class="chart-point-group">
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--primary)" stroke="var(--surface)" stroke-width="2" class="chart-point" />
        <circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent" class="chart-hitbox" style="cursor:pointer;" />
        <text x="${p.x}" y="${p.y - 12}" fill="var(--primary-dark)" font-size="10" font-weight="900" text-anchor="middle" class="chart-point-label">${displayVal}</text>
        <text x="${p.x}" y="${height - 15}" fill="var(--muted)" font-size="9" font-weight="800" text-anchor="middle" class="chart-x-label">${p.label}</text>
      </g>
    `;
  }).join("");

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible;">
      <defs>
        <linearGradient id="line-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.32" />
          <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.0" />
        </linearGradient>
        <style>
          .chart-point-group:hover circle.chart-point {
            fill: var(--accent);
            r: 7;
          }
          .chart-point-group:hover text.chart-point-label {
            fill: var(--accent);
            font-size: 11px;
            font-weight: 900;
          }
          .chart-point-label {
            opacity: 0.85;
            transition: all 180ms ease;
          }
          .chart-point {
            transition: all 180ms ease;
          }
        </style>
      </defs>
      ${gridHtml}
      ${areaPathD ? `<path d="${areaPathD}" fill="url(#line-area-grad)" />` : ""}
      ${linePathD ? `<path d="${linePathD}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : ""}
      ${interactiveElements}
    </svg>
  `;
}

function renderStatusChart(analysis) {
  const chart = document.querySelector("[data-status-chart]");
  if (!chart) return;
  const total = Math.max(analysis.bookingTotal, 1);
  const approvedEnd = (analysis.approved / total) * 100;
  const pendingEnd = approvedEnd + (analysis.pending / total) * 100;
  const paidPercent = analysis.bookingTotal ? Math.round((analysis.paidBookings / analysis.bookingTotal) * 100) : 0;

  chart.innerHTML = `
    <div class="donut-chart" style="background: conic-gradient(var(--success) 0 ${approvedEnd}%, var(--gold) ${approvedEnd}% ${pendingEnd}%, var(--danger) ${pendingEnd}% 100%);">
      <div>
        <strong>${paidPercent}%</strong>
        <span>paid</span>
      </div>
    </div>
    <div class="chart-legend">
      ${legendItem("Approved", analysis.approved, "success")}
      ${legendItem("Pending", analysis.pending, "pending")}
      ${legendItem("Rejected", analysis.rejected, "danger")}
      ${legendItem("Unpaid", analysis.unpaidBookings, "muted")}
    </div>
  `;
}

function renderCityChart(state) {
  const cities = groupCount(state.hotels, (hotel) => hotel.city)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  renderRankedList("[data-city-chart]", cities, state.hotels.length, "properties");
}

function renderRoomChart(state) {
  const segments = [
    { label: "60+ rooms", value: state.hotels.filter((hotel) => hotel.rooms >= 60).length },
    { label: "40-59 rooms", value: state.hotels.filter((hotel) => hotel.rooms >= 40 && hotel.rooms < 60).length },
    { label: "25-39 rooms", value: state.hotels.filter((hotel) => hotel.rooms >= 25 && hotel.rooms < 40).length },
    { label: "Under 25 rooms", value: state.hotels.filter((hotel) => hotel.rooms < 25).length }
  ];
  renderRankedList("[data-room-chart]", segments, state.hotels.length, "hotels");
}

function renderRankedList(selector, items, total, unit) {
  const root = document.querySelector(selector);
  const max = Math.max(...items.map((item) => item.value), 1);
  root.innerHTML = items.length
    ? items
        .map((item) => `
          <article class="ranked-item">
            <div>
              <span>${escapeHtml(item.label)}</span>
              <strong>${item.value} ${escapeHtml(unit)}</strong>
            </div>
            <div class="bar-track"><div class="bar-fill muted" style="width:${Math.max(5, Math.round((item.value / max) * 100))}%"></div></div>
            <small>${total ? Math.round((item.value / total) * 100) : 0}%</small>
          </article>
        `)
        .join("")
    : `<div class="empty-state">No data available.</div>`;
}

function renderOverviewLists(state) {
  const analysis = analyzeState(state);
  document.querySelector("[data-pending-count]").textContent = `${analysis.pending} pending`;
  document.querySelector("[data-payment-total]").textContent = formatCurrency(analysis.paidRevenue);

  const recentBookings = state.bookings.slice(0, 5);
  document.querySelector("[data-recent-bookings]").innerHTML = recentBookings.length
    ? recentBookings.map((booking) => compactBookingItem(state, booking)).join("")
    : `<div class="empty-state">No bookings yet.</div>`;

  document.querySelector("[data-payment-monitor]").innerHTML = state.bookings.length
    ? state.bookings
        .slice(0, 5)
        .map((booking) => {
          const hotel = findHotel(state, booking.hotelId);
          const user = findUser(state, booking.userId);
          const totalCost = hotel ? Number(hotel.price || 0) * getBookingNights(booking) : 0;
          return `
            <article class="compact-item">
              <h3>${escapeHtml(user?.name || "Unknown guest")}</h3>
              <p>${escapeHtml(hotel?.name || "Hotel removed")} / ${escapeHtml(formatCurrency(totalCost))}</p>
              <div class="action-row">
                ${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}
                ${statusPill(booking.status)}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">No payments yet.</div>`;
}

function renderSectionSummaries(state) {
  const bookingRows = getFilteredBookings(state);
  const userRows = getFilteredUsers(state);
  const hotelRows = getFilteredHotels(state);
  const tripRows = getFilteredTrips(state);

  setSummary("[data-booking-summary]", [
    ["Visible bookings", bookingRows.length],
    ["Pending", bookingRows.filter((booking) => booking.status === "pending").length],
    ["Paid", bookingRows.filter((booking) => booking.payment === "paid").length],
    ["Revenue", formatCurrency(getBookingsRevenue(state, bookingRows))]
  ]);
  setSummary("[data-user-summary]", [
    ["Visible users", userRows.length],
    ["Admins", userRows.filter((user) => user.role === "admin").length],
    ["Guests", userRows.filter((user) => user.role === "guest").length],
    ["Active", userRows.filter((user) => user.status === "Active").length]
  ]);
  setSummary("[data-hotel-summary]", [
    ["Visible hotels", hotelRows.length],
    ["Rooms", hotelRows.reduce((sum, hotel) => sum + Number(hotel.rooms || 0), 0)],
    ["Cities", groupCount(hotelRows, (hotel) => hotel.city).length],
    ["Avg rate", formatCurrency(average(hotelRows.map((hotel) => Number(hotel.price || 0))))]
  ]);
  setSummary("[data-trip-summary]", [
    ["Visible trips", tripRows.length],
    ["Confirmed", tripRows.filter((trip) => trip.status === "Confirmed").length],
    ["Planning", tripRows.filter((trip) => trip.status === "Planning").length],
    ["Destinations", groupCount(tripRows, (trip) => trip.destination).length]
  ]);
}

function setSummary(selector, items) {
  const root = document.querySelector(selector);
  if (!root) return;
  root.innerHTML = items
    .map(([label, value]) => `
      <article>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `)
    .join("");
}

function compactBookingItem(state, booking) {
  const hotel = findHotel(state, booking.hotelId);
  const user = findUser(state, booking.userId);
  const totalCost = hotel ? Number(hotel.price || 0) * getBookingNights(booking) : 0;
  return `
    <article class="compact-item">
      <h3>${escapeHtml(hotel?.name || "Hotel removed")}</h3>
      <p>${escapeHtml(user?.name || "Unknown guest")} / ${escapeHtml(booking.checkIn)} to ${escapeHtml(booking.checkOut)} / ${escapeHtml(formatCurrency(totalCost))}</p>
      <div class="action-row">
        ${statusPill(booking.status)}
        ${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}
      </div>
    </article>
  `;
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

function renderHotels(state) {
  const filteredHotels = getFilteredHotels(state);
  document.querySelector("[data-hotel-count]").textContent =
    filteredHotels.length === state.hotels.length ? `${state.hotels.length} hotels` : `${filteredHotels.length} of ${state.hotels.length} hotels`;

  document.querySelector("[data-admin-hotels]").innerHTML = filteredHotels.length
    ? filteredHotels
        .map((hotel) => `
          <article class="compact-item">
            <h3>${escapeHtml(hotel.name)}</h3>
            <p>${escapeHtml(hotel.city)} / ${escapeHtml(formatCurrency(hotel.price))} per night / ${Number(hotel.rooms)} rooms / ${Number(hotel.rating).toFixed(1)} rating</p>
            <div class="action-row">
              ${(hotel.amenities || []).slice(0, 3).map((amenity) => `<span class="status-pill">${escapeHtml(amenity)}</span>`).join("")}
              <button class="pill-button delete" type="button" data-delete-hotel="${hotel.id}">Delete</button>
            </div>
          </article>
        `)
        .join("")
    : `<div class="empty-state">No hotels found.</div>`;
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

function getFilteredUsers(state) {
  return state.users.filter((user) => {
    const search = filters.users.search;
    const matchesSearch = !search || user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search) || user.phone?.toLowerCase().includes(search);
    return matchesSearch && (filters.users.role === "all" || user.role === filters.users.role);
  });
}

function getFilteredHotels(state) {
  return state.hotels.filter((hotel) => {
    const search = filters.hotels.search;
    return !search || hotel.name.toLowerCase().includes(search) || hotel.city.toLowerCase().includes(search) || (hotel.amenities || []).join(" ").toLowerCase().includes(search);
  });
}

function getFilteredTrips(state) {
  return state.trips.filter((trip) => {
    const search = filters.trips.search;
    return !search || trip.title.toLowerCase().includes(search) || trip.guest.toLowerCase().includes(search) || trip.destination.toLowerCase().includes(search);
  });
}

function analyzeState(state) {
  const paidBookings = state.bookings.filter((booking) => booking.payment === "paid");
  return {
    bookingTotal: state.bookings.length,
    pending: state.bookings.filter((booking) => booking.status === "pending").length,
    approved: state.bookings.filter((booking) => booking.status === "approved").length,
    rejected: state.bookings.filter((booking) => booking.status === "rejected").length,
    paidBookings: paidBookings.length,
    unpaidBookings: state.bookings.filter((booking) => booking.payment !== "paid").length,
    paidRevenue: getBookingsRevenue(state, paidBookings),
    totalRooms: state.hotels.reduce((sum, hotel) => sum + Number(hotel.rooms || 0), 0),
    averageRating: average(state.hotels.map((hotel) => Number(hotel.rating || 0))),
    cityCount: groupCount(state.hotels, (hotel) => hotel.city).length
  };
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

function legendItem(label, value, tone) {
  return `
    <span class="legend-item ${tone}">
      <i></i>
      ${escapeHtml(label)}
      <strong>${Number(value)}</strong>
    </span>
  `;
}

function shortenHotelName(name) {
  return String(name)
    .replace(/\s+(Hotel|Resort|Retreat|Suites|House|Residence|Lodge|Inn)$/i, "")
    .slice(0, 18);
}

function buildingIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V5.8C4 4.8 4.8 4 5.8 4h8.4c1 0 1.8.8 1.8 1.8V21M16 9h2.2c1 0 1.8.8 1.8 1.8V21M8 8h4M8 12h4M8 16h4M3 21h18"/></svg>`;
}

function calendarIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M6 5h12c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2z"/></svg>`;
}

function dollarIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
}

function roomIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19V7M21 19v-5.5A3.5 3.5 0 0 0 17.5 10H12v9M3 14h18M3 10h6a3 3 0 0 1 3 3v1M3 19h18"/></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
