import { clearCurrentUser, findHotel, findUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, formatCurrency, initAuthChrome, initTheme, showToast, statusPill, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

let activeTab = "hotel";

const filters = {
  bookings: { search: "", status: "all", payment: "all" },
  tripBookings: { search: "", status: "all", payment: "all" }
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
  initTabs();
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

function initTabs() {
  document.querySelectorAll(".booking-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".booking-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.dataset.bookingType;

      const header = document.querySelector("[data-booking-type-header]");
      const searchInput = document.querySelector("[data-filter-booking-search]");
      if (activeTab === "hotel") {
        if (header) header.textContent = "Hotel";
        if (searchInput) {
          searchInput.placeholder = "Search guest, hotel, room type...";
          searchInput.value = filters.bookings.search;
        }
      } else {
        if (header) header.textContent = "Trip";
        if (searchInput) {
          searchInput.placeholder = "Search guest, trip title, destination...";
          searchInput.value = filters.tripBookings.search;
        }
      }

      const statusFilter = document.querySelector("[data-filter-booking-status]");
      const paymentFilter = document.querySelector("[data-filter-booking-payment]");
      if (statusFilter) statusFilter.value = filters[activeTab === "hotel" ? "bookings" : "tripBookings"].status;
      if (paymentFilter) paymentFilter.value = filters[activeTab === "hotel" ? "bookings" : "tripBookings"].payment;

      renderBookingsPage();
    });
  });
}

function executeBookingAction(bookingId, bookingAction) {
  if (bookingAction === "delete") {
    const itemText = activeTab === "hotel" ? "hotel booking request" : "trip booking request";
    showConfirm(`Delete this ${itemText}?`, () => {
      updateState((state) => {
        if (activeTab === "hotel") {
          state.bookings = state.bookings.filter((item) => item.id !== bookingId);
        } else {
          state.tripBookings = (state.tripBookings || []).filter((item) => item.id !== bookingId);
        }
      });
      renderBookingsPage();
      showToast("Booking request deleted.");
    });
    return;
  }

  updateState((state) => {
    const list = activeTab === "hotel" ? state.bookings : (state.tripBookings || []);
    const booking = list.find((item) => item.id === bookingId);
    if (!booking) return;
    if (bookingAction === "approve") booking.status = "approved";
    if (bookingAction === "reject") booking.status = "rejected";
  });

  renderBookingsPage();
  showToast("Booking updated.");
}

function initAdminForms() {
  document.querySelector("[data-bookings-table]")?.addEventListener("click", (event) => {
    const dotsBtn = event.target.closest(".three-dots-btn");
    if (dotsBtn) {
      event.stopPropagation();
      const dropdown = document.getElementById("globalBookingDropdown");
      if (!dropdown) return;

      const bookingId = dotsBtn.dataset.bookingId;
      const bookingStatus = dotsBtn.dataset.bookingStatus;

      const isSame = dropdown.style.display === "flex" && dropdown.dataset.activeBookingId === bookingId;
      if (isSame) {
        dropdown.style.display = "none";
        dropdown.removeAttribute("data-active-booking-id");
        return;
      }

      dropdown.dataset.activeBookingId = bookingId;
      dropdown.querySelectorAll("[data-booking-action]").forEach((btn) => {
        btn.dataset.bookingId = bookingId;
        if (btn.dataset.bookingAction === "approve") {
          if (bookingStatus === "approved") {
            btn.setAttribute("disabled", "true");
          } else {
            btn.removeAttribute("disabled");
          }
        }
        if (btn.dataset.bookingAction === "reject") {
          if (bookingStatus === "rejected") {
            btn.setAttribute("disabled", "true");
          } else {
            btn.removeAttribute("disabled");
          }
        }
      });

      dropdown.style.display = "flex";

      const rect = dotsBtn.getBoundingClientRect();
      const dropdownWidth = 150;
      let left = rect.right - dropdownWidth;
      if (left < 10) left = 10;

      let top = rect.bottom + 4;
      const dropdownHeight = dropdown.offsetHeight || 116;
      if (top + dropdownHeight > window.innerHeight) {
        top = rect.top - dropdownHeight - 4;
      }

      dropdown.style.top = `${top}px`;
      dropdown.style.left = `${left}px`;
    }
  });

  const globalBookingDropdown = document.getElementById("globalBookingDropdown");
  globalBookingDropdown?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-booking-action]");
    if (!actionButton) return;
    if (actionButton.hasAttribute("disabled") || actionButton.disabled) return;
    event.stopPropagation();

    globalBookingDropdown.style.display = "none";
    globalBookingDropdown.removeAttribute("data-active-booking-id");

    const { bookingId, bookingAction } = actionButton.dataset;
    executeBookingAction(bookingId, bookingAction);
  });

  document.addEventListener("click", (event) => {
    const globalBookingDropdown = document.getElementById("globalBookingDropdown");
    if (globalBookingDropdown && !event.target.closest(".three-dots-btn") && !event.target.closest("#globalBookingDropdown")) {
      globalBookingDropdown.style.display = "none";
      globalBookingDropdown.removeAttribute("data-active-booking-id");
    }
  });

  window.addEventListener("scroll", () => {
    const globalBookingDropdown = document.getElementById("globalBookingDropdown");
    if (globalBookingDropdown && globalBookingDropdown.style.display === "flex") {
      globalBookingDropdown.style.display = "none";
      globalBookingDropdown.removeAttribute("data-active-booking-id");
    }
  }, true);
}

function initFilters() {
  bindFilter("[data-filter-booking-search]", "input", (event) => {
    const key = activeTab === "hotel" ? "bookings" : "tripBookings";
    filters[key].search = event.target.value.toLowerCase().trim();
    renderBookingsPage();
  });
  bindFilter("[data-filter-booking-status]", "change", (event) => {
    const key = activeTab === "hotel" ? "bookings" : "tripBookings";
    filters[key].status = event.target.value;
    renderBookingsPage();
  });
  bindFilter("[data-filter-booking-payment]", "change", (event) => {
    const key = activeTab === "hotel" ? "bookings" : "tripBookings";
    filters[key].payment = event.target.value;
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
  const tableBody = document.querySelector("[data-bookings-table]");
  if (!tableBody) return;

  if (activeTab === "hotel") {
    const filteredBookings = getFilteredBookings(state);
    tableBody.innerHTML = filteredBookings.length
      ? filteredBookings
        .map((booking) => {
          const hotel = findHotel(state, booking.hotelId);
          const user = findUser(state, booking.userId);
          const nights = getBookingNights(booking);
          const totalCost = hotel ? Number(hotel.price || 0) * nights : 0;
          const hotelImage = hotel?.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=80&q=80";

          return `
              <tr>
                <td><strong>${escapeHtml(user?.name || "Unknown guest")}</strong><br>${escapeHtml(user?.email || "")}</td>
                <td>
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="${hotelImage}" alt="${escapeHtml(hotel?.name || 'Hotel')}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--line);" />
                    <div>
                      <strong>${escapeHtml(hotel?.name || "Hotel removed")}</strong><br>
                      ${escapeHtml(booking.roomType)} / ${Number(booking.guests)} guest(s)<br>
                      <small>${hotel ? `${formatCurrency(hotel.price)} x ${nights} night${nights === 1 ? "" : "s"} = ${formatCurrency(totalCost)}` : ""}</small>
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(booking.checkIn)}<br>${escapeHtml(booking.checkOut)}</td>
                <td>${statusPill(booking.payment === "paid" ? "paid" : "unpaid")}</td>
                <td>${statusPill(booking.status)}</td>
                <td>
                  <div class="actions-dropdown-container">
                    <button class="three-dots-btn" type="button" aria-label="Actions" 
                            data-booking-id="${booking.id}" 
                            data-booking-status="${booking.status}">⋮</button>
                  </div>
                </td>
              </tr>
            `;
        })
        .join("")
      : `<tr><td colspan="6">No hotel booking requests found.</td></tr>`;
  } else {
    const filteredTripBookings = getFilteredTripBookings(state);
    tableBody.innerHTML = filteredTripBookings.length
      ? filteredTripBookings
        .map((request) => {
          const user = findUser(state, request.userId);
          const trip = state.trips.find((t) => t.id === request.tripId);
          const budget = trip ? Number(trip.budget || 0) : 0;
          const deposit = Math.round(budget * 0.1);
          const tripImage = trip?.image || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=80&q=80";

          return `
              <tr>
                <td><strong>${escapeHtml(user?.name || "Unknown guest")}</strong><br>${escapeHtml(user?.email || "")}</td>
                <td>
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="${tripImage}" alt="${escapeHtml(request.tripTitle || 'Trip')}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--line);" />
                    <div>
                      <strong>${escapeHtml(request.tripTitle || "Trip request")}</strong><br>
                      ${escapeHtml(request.destination || "Destination pending")} / ${Number(request.travelers || 1)} traveler(s)<br>
                      <small>${escapeHtml(request.packageType || "Standard plan")} (${formatCurrency(deposit)} deposit)</small>
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(request.preferredDate || "Date pending")}</td>
                <td>
                  ${statusPill(request.payment === "paid" ? "paid" : "unpaid")}
                  ${request.paymentMethod && request.paymentMethod !== "Payment method pending" ? `<br><small>${escapeHtml(request.paymentMethod)}</small>` : ""}
                  ${request.transactionId ? `<br><code style="font-family: monospace; font-size: 0.8rem; font-weight: bold; color: var(--gold);">${escapeHtml(request.transactionId)}</code>` : ""}
                </td>
                <td>${statusPill(request.status || "pending")}</td>
                <td>
                  <div class="actions-dropdown-container">
                    <button class="three-dots-btn" type="button" aria-label="Actions" 
                            data-booking-id="${request.id}" 
                            data-booking-status="${request.status}">⋮</button>
                  </div>
                </td>
              </tr>
            `;
        })
        .join("")
      : `<tr><td colspan="6">No trip booking requests found.</td></tr>`;
  }
}

function renderBookingsSummary(state) {
  const root = document.querySelector("[data-booking-summary]");
  if (!root) return;

  if (activeTab === "hotel") {
    const bookingRows = getFilteredBookings(state);
    const items = [
      ["Visible Bookings", bookingRows.length],
      ["Pending Review", bookingRows.filter((booking) => booking.status === "pending").length],
      ["Paid Bookings", bookingRows.filter((booking) => booking.payment === "paid").length],
      ["Hotel Revenue", formatCurrency(getBookingsRevenue(state, bookingRows))]
    ];

    root.innerHTML = items
      .map(([label, value]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `)
      .join("");
  } else {
    const bookingRows = getFilteredTripBookings(state);
    const totalRevenue = bookingRows.reduce((sum, request) => {
      if (request.payment !== "paid") return sum;
      const trip = state.trips.find((t) => t.id === request.tripId);
      const budget = trip ? Number(trip.budget || 0) : 0;
      return sum + Math.round(budget * 0.1);
    }, 0);

    const items = [
      ["Visible Requests", bookingRows.length],
      ["Pending Approval", bookingRows.filter((r) => r.status === "pending").length],
      ["Paid Deposit", bookingRows.filter((r) => r.payment === "paid").length],
      ["Deposit Revenue", formatCurrency(totalRevenue)]
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
    return (
      matchesSearch &&
      (filters.bookings.status === "all" || booking.status === filters.bookings.status) &&
      (filters.bookings.payment === "all" || booking.payment === filters.bookings.payment)
    );
  });
}

function getFilteredTripBookings(state) {
  return (state.tripBookings || []).filter((request) => {
    const user = findUser(state, request.userId);
    const search = filters.tripBookings.search;
    const matchesSearch =
      !search ||
      user?.name?.toLowerCase().includes(search) ||
      user?.email?.toLowerCase().includes(search) ||
      request.tripTitle?.toLowerCase().includes(search) ||
      request.destination?.toLowerCase().includes(search) ||
      request.packageType?.toLowerCase().includes(search);
    return (
      matchesSearch &&
      (filters.tripBookings.status === "all" || request.status === filters.tripBookings.status) &&
      (filters.tripBookings.payment === "all" || request.payment === filters.tripBookings.payment)
    );
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
