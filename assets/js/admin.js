import { clearCurrentUser, createId, findHotel, findUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { loadHotelCatalog } from "./hotel-catalog.js";
import { animatePage, formatCurrency, initAuthChrome, initTheme, showToast, statusPill, updateUserNavAvatar, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  bookings: { search: "", status: "all", payment: "all" },
  users: { search: "", role: "all" },
  hotels: { search: "" },
  trips: { search: "" },
  transactions: { search: "", type: "all", method: "all", status: "all" }
};

let currentConfirmAction = null;
const adminPageTitles = {
  overview: "Operations dashboard",
  bookings: "Booking approval desk",
  transactions: "Transaction payment methods",
  users: "User directory",
  hotels: "Hotel portfolio",
  trips: "Trip operations",
  profile: "Admin profile"
};

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
  initChartTooltips();
  renderAdminProfile();
  renderAdmin();
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

function initAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll("[data-admin-section]").forEach((section) => section.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`[data-admin-section="${button.dataset.adminTab}"]`).classList.add("active");
      const title = document.querySelector("[data-admin-page-title]");
      if (title) title.textContent = adminPageTitles[button.dataset.adminTab] || "Admin dashboard";
    });
  });

  document.querySelector("[data-admin-profile-footer]")?.addEventListener("click", () => {
    document.querySelector('[data-admin-tab="profile"]')?.click();
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

  document.querySelector("[data-admin-trip-bookings]")?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-trip-booking-action]");
    if (!actionButton) return;
    const { tripBookingId, tripBookingAction } = actionButton.dataset;

    if (tripBookingAction === "delete") {
      showConfirm("Delete this trip request?", () => {
        updateState((state) => {
          state.tripBookings = (state.tripBookings || []).filter((item) => item.id !== tripBookingId);
        });
        renderAdmin();
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

    renderAdmin();
    showToast("Trip request updated.");
  });

  const profileForm = document.querySelector("[data-admin-profile-form]");
  profileForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(profileForm);
    const email = String(formData.get("email")).trim().toLowerCase();
    const state = getState();

    if (state.users.some((user) => user.id !== currentUser.id && user.email.toLowerCase() === email)) {
      showToast("Another account already uses this email.", "warning");
      return;
    }

    updateState((draft) => {
      const admin = draft.users.find((user) => user.id === currentUser.id);
      if (!admin) return;
      admin.name = String(formData.get("name")).trim();
      admin.email = email;
      admin.phone = String(formData.get("phone")).trim();
      admin.title = String(formData.get("title")).trim();
      admin.department = String(formData.get("department")).trim();
      admin.location = String(formData.get("location")).trim();
      admin.status = String(formData.get("status"));
      admin.bio = String(formData.get("bio")).trim();
      const nextPassword = String(formData.get("password")).trim();
      if (nextPassword) admin.password = nextPassword;

      Object.assign(currentUser, admin);
    });

    profileForm.reset();
    renderAdmin();
    updateUserNavAvatar(currentUser);
    showToast("Admin profile updated.");
  });

  profileForm?.addEventListener("reset", () => {
    window.setTimeout(renderAdminProfile, 0);
  });

  document.querySelector("[data-admin-profile-card]")?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-admin-profile-image-input]");
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please upload a valid image file.", "warning");
      input.value = "";
      return;
    }

    if (file.size > 750 * 1024) {
      showToast("Profile image must be under 750 KB.", "warning");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const avatar = String(reader.result || "");
      updateState((state) => {
        const admin = state.users.find((user) => user.id === currentUser.id);
        if (admin) {
          admin.avatar = avatar;
          currentUser.avatar = avatar;
        }
      });
      renderAdminProfile();
      updateUserNavAvatar(currentUser);
      showToast("Admin photo updated.");
    });
    reader.addEventListener("error", () => {
      showToast("Could not read that image file.", "warning");
    });
    reader.readAsDataURL(file);
  });

  document.querySelector("[data-transactions-table]")?.addEventListener("click", (event) => {
    // Toggle actions dropdown menu on three-dots click
    const dotsBtn = event.target.closest(".three-dots-btn");
    if (dotsBtn) {
      event.stopPropagation();
      const menu = dotsBtn.nextElementSibling;
      if (menu) {
        const wasHidden = menu.hasAttribute("hidden");
        document.querySelectorAll(".actions-dropdown-menu").forEach((m) => m.setAttribute("hidden", ""));
        if (wasHidden) {
          menu.removeAttribute("hidden");
        } else {
          menu.setAttribute("hidden", "");
        }
      }
      return;
    }

    const actionButton = event.target.closest("[data-tx-action]");
    if (!actionButton) return;
    const { txId, txItemType, txAction } = actionButton.dataset;

    const menu = actionButton.closest(".actions-dropdown-menu");
    if (menu) menu.setAttribute("hidden", "");

    if (txAction === "delete") {
      showConfirm("Delete this request record?", () => {
        updateState((state) => {
          if (txItemType === "booking") {
            state.bookings = state.bookings.filter((item) => item.id !== txId);
          } else if (txItemType === "tripBooking") {
            state.tripBookings = (state.tripBookings || []).filter((item) => item.id !== txId);
          }
        });
        renderAdmin();
        showToast("Request record deleted.");
      });
      return;
    }

    if (txAction === "approve") {
      updateState((state) => {
        if (txItemType === "booking") {
          const item = state.bookings.find((b) => b.id === txId);
          if (item) item.status = "approved";
        } else if (txItemType === "tripBooking") {
          const item = (state.tripBookings || []).find((tb) => tb.id === txId);
          if (item) item.status = "approved";
        }
      });
      renderAdmin();
      showToast("Booking request approved.");
      return;
    }

    if (txAction === "view") {
      const state = getState();
      const transactions = [];

      // Re-gather transactions with user details to populate details modal
      (state.bookings || []).forEach((booking) => {
        const hotel = findHotel(state, booking.hotelId);
        const user = findUser(state, booking.userId);
        const nights = getBookingNights(booking);
        const totalCost = hotel ? Number(hotel.price || 0) * nights : 0;
        transactions.push({
          id: booking.id,
          itemType: "booking",
          type: "Hotel Stay",
          guestName: user?.name || "Unknown guest",
          guestEmail: user?.email || "",
          guestPhone: user?.phone || "N/A",
          reference: hotel?.name || "Hotel removed",
          detail: `${booking.roomType || "Standard"} / ${booking.checkIn} to ${booking.checkOut}`,
          method: booking.paymentMethod || "N/A",
          transactionId: booking.transactionId || "",
          amount: totalCost,
          status: booking.payment || "pending",
          bookingStatus: booking.status || "pending",
          note: booking.note || "",
          createdAt: booking.createdAt || ""
        });
      });

      (state.tripBookings || []).forEach((request) => {
        const user = findUser(state, request.userId);
        const trip = state.trips.find((t) => t.id === request.tripId);
        const totalBudget = trip ? Number(trip.budget || 0) : 0;
        const depositAmount = Math.round(totalBudget * 0.1);
        transactions.push({
          id: request.id,
          itemType: "tripBooking",
          type: "Trip Plan",
          guestName: user?.name || "Unknown guest",
          guestEmail: user?.email || "",
          guestPhone: user?.phone || "N/A",
          reference: request.tripTitle || "Trip removed",
          detail: `${request.destination || "Destination pending"} / ${request.packageType || "Standard plan"}`,
          method: request.paymentMethod || "N/A",
          transactionId: request.transactionId || "",
          amount: depositAmount,
          status: request.payment || "pending",
          bookingStatus: request.status || "pending",
          note: request.note || "",
          createdAt: request.createdAt || ""
        });
      });

      const tx = transactions.find((t) => t.id === txId);
      if (!tx) return;

      const overlay = document.querySelector("[data-tx-details-overlay]");
      const content = document.querySelector("[data-tx-details-content]");
      if (!overlay || !content) return;

      let detailsHtml = `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 0.5rem; margin-bottom: 0.5rem; width: 100%;">
          <strong>Reference ID:</strong>
          <span style="color: var(--muted); font-weight: 700;">#${escapeHtml(tx.id)}</span>
        </div>
        <div><strong>Type:</strong> <span class="status-pill">${escapeHtml(tx.type)}</span></div>
        <div><strong>Guest Name:</strong> ${escapeHtml(tx.guestName)}</div>
        <div><strong>Guest Email:</strong> ${escapeHtml(tx.guestEmail)}</div>
        <div><strong>Guest Phone:</strong> ${escapeHtml(tx.guestPhone)}</div>
        <div><strong>Reference Name:</strong> ${escapeHtml(tx.reference)}</div>
        <div><strong>Details:</strong> ${escapeHtml(tx.detail)}</div>
        <div><strong>Payment Method:</strong> <span class="status-pill">${escapeHtml(tx.method)}</span></div>
        <div><strong>Transaction ID:</strong> <code style="font-family: monospace; font-size: 0.95rem; font-weight: bold; color: var(--gold);">${escapeHtml(tx.transactionId || "N/A")}</code></div>
        <div><strong>Amount:</strong> <strong>${formatCurrency(tx.amount)}</strong></div>
        <div><strong>Payment Status:</strong> ${escapeHtml(tx.status.toUpperCase())}</div>
        <div><strong>Booking Status:</strong> ${escapeHtml(tx.bookingStatus.toUpperCase())}</div>
      `;

      if (tx.note) {
        detailsHtml += `<div style="grid-column: 1 / -1; margin-top: 0.5rem; border-top: 1px dashed var(--line); padding-top: 0.5rem; width: 100%;">
          <strong>Special Request Notes:</strong>
          <p style="margin: 0.2rem 0; color: var(--muted); line-height: 1.4;">${escapeHtml(tx.note)}</p>
        </div>`;
      }

      content.innerHTML = detailsHtml;
      overlay.classList.add("open");
      return;
    }
  });

  // Close actions dropdown when clicking outside
  document.addEventListener("click", () => {
    document.querySelectorAll(".actions-dropdown-menu").forEach((m) => m.setAttribute("hidden", ""));
  });

  const methodForm = document.querySelector("[data-payment-method-form]");
  const cancelMethodEditBtn = document.getElementById("cancelMethodEdit");

  methodForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(methodForm);
    const methodId = formData.get("methodId");
    const name = String(formData.get("methodName")).trim();
    const number = String(formData.get("methodNumber")).trim();
    const logo = String(formData.get("methodLogo")).trim();

    updateState((state) => {
      state.paymentMethods = state.paymentMethods || [];
      if (methodId) {
        // Edit existing
        const existing = state.paymentMethods.find((m) => m.id === methodId);
        if (existing) {
          existing.name = name;
          existing.number = number;
          existing.logo = logo || "https://images.unsplash.com/photo-1579621970795-87faff3f2160?auto=format&fit=crop&w=80&q=80";
        }
      } else {
        // Create new
        state.paymentMethods.push({
          id: createId("pm"),
          name,
          number,
          logo: logo || "https://images.unsplash.com/photo-1579621970795-87faff3f2160?auto=format&fit=crop&w=80&q=80"
        });
      }
    });

    methodForm.reset();
    document.getElementById("methodId").value = "";
    if (cancelMethodEditBtn) cancelMethodEditBtn.style.display = "none";
    renderAdmin();
    showToast("Payment method saved.");
  });

  cancelMethodEditBtn?.addEventListener("click", () => {
    methodForm.reset();
    document.getElementById("methodId").value = "";
    cancelMethodEditBtn.style.display = "none";
  });

  document.querySelector("[data-admin-payment-methods]")?.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-edit-method-id]");
    const deleteBtn = event.target.closest("[data-delete-method-id]");

    if (editBtn) {
      const methodId = editBtn.dataset.editMethodId;
      const state = getState();
      const method = (state.paymentMethods || []).find((m) => m.id === methodId);
      if (method) {
        document.getElementById("methodId").value = method.id;
        document.getElementById("methodName").value = method.name;
        document.getElementById("methodNumber").value = method.number;
        document.getElementById("methodLogo").value = method.logo || "";
        if (cancelMethodEditBtn) cancelMethodEditBtn.style.display = "inline-block";
      }
      return;
    }

    if (deleteBtn) {
      const methodId = deleteBtn.dataset.deleteMethodId;
      showConfirm("Delete this payment method?", () => {
        updateState((state) => {
          state.paymentMethods = (state.paymentMethods || []).filter((m) => m.id !== methodId);
        });
        renderAdmin();
        showToast("Payment method deleted.");
      });
      return;
    }
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
  bindFilter("[data-filter-transaction-search]", "input", (event) => {
    filters.transactions.search = event.target.value.toLowerCase().trim();
    renderTransactions(getState());
  });
  bindFilter("[data-filter-transaction-type]", "change", (event) => {
    filters.transactions.type = event.target.value;
    renderTransactions(getState());
  });
  bindFilter("[data-filter-transaction-method]", "change", (event) => {
    filters.transactions.method = event.target.value;
    renderTransactions(getState());
  });
  bindFilter("[data-filter-transaction-status]", "change", (event) => {
    filters.transactions.status = event.target.value;
    renderTransactions(getState());
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

  const detailsOverlay = document.querySelector("[data-tx-details-overlay]");
  const detailsCloseBtn = document.querySelector("[data-tx-details-close]");
  if (detailsOverlay && detailsCloseBtn) {
    detailsCloseBtn.addEventListener("click", () => {
      detailsOverlay.classList.remove("open");
    });
    detailsOverlay.addEventListener("click", (event) => {
      if (event.target === detailsOverlay) {
        detailsOverlay.classList.remove("open");
      }
    });
  }
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
  renderTripBookings(state);
  renderTransactions(state);
  renderPaymentMethods(state);
  renderAdminProfile();
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

  const profileCard = document.querySelector("[data-admin-profile-card]");
  if (profileCard) {
    profileCard.innerHTML = `
      <div class="admin-profile-cover"></div>
      <div class="admin-profile-avatar-wrap">
        <div class="admin-profile-avatar">${userAvatarMarkup(currentUser, "admin-profile-avatar-image")}</div>
        <label class="admin-profile-upload" title="Change photo" aria-label="Change profile photo">
          <input type="file" accept="image/png,image/jpeg,image/webp" data-admin-profile-image-input />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h3l1.6-2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
            <circle cx="12" cy="14" r="3.2" />
          </svg>
        </label>
      </div>
      <div class="admin-profile-summary">
        <p class="eyebrow">Signed in as</p>
        <h2>${escapeHtml(currentUser.name)}</h2>
        <p>${escapeHtml(currentUser.title || "Admin")} / ${escapeHtml(currentUser.department || "Operations")}</p>
      </div>
      <div class="admin-profile-facts">
        <article><span>Email</span><strong>${escapeHtml(currentUser.email)}</strong></article>
        <article><span>Phone</span><strong>${escapeHtml(currentUser.phone || "Not set")}</strong></article>
        <article><span>Location</span><strong>${escapeHtml(currentUser.location || "Not set")}</strong></article>
        <article><span>Status</span><strong>${escapeHtml(currentUser.status || "Active")}</strong></article>
      </div>
      <p class="admin-profile-bio">${escapeHtml(currentUser.bio || "No bio added yet.")}</p>
    `;
  }

  const form = document.querySelector("[data-admin-profile-form]");
  if (form) {
    form.elements.namedItem("name").value = currentUser.name || "";
    form.elements.namedItem("email").value = currentUser.email || "";
    form.elements.namedItem("phone").value = currentUser.phone || "";
    form.elements.namedItem("title").value = currentUser.title || "";
    form.elements.namedItem("department").value = currentUser.department || "";
    form.elements.namedItem("location").value = currentUser.location || "";
    form.elements.namedItem("status").value = currentUser.status || "Active";
    form.elements.namedItem("password").value = "";
    form.elements.namedItem("bio").value = currentUser.bio || "";
  }
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
  renderTrendsChart(state);
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
        <circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent" pointer-events="all" class="chart-hitbox" style="cursor:pointer;" data-tooltip-title="${p.label}" data-tooltip-value="${displayVal}" />
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

  if (window.gsap) {
    const linePath = chartContainer.querySelector("path[stroke='var(--primary)']");
    const areaPath = chartContainer.querySelector("path[fill^='url(#line-area-grad)']");
    const points = chartContainer.querySelectorAll(".chart-point");
    const pointLabels = chartContainer.querySelectorAll(".chart-point-label");
    const xLabels = chartContainer.querySelectorAll(".chart-x-label");

    const tl = window.gsap.timeline();

    if (linePath) {
      const pathLength = linePath.getTotalLength();
      tl.fromTo(linePath,
        { strokeDasharray: pathLength, strokeDashoffset: pathLength },
        { strokeDashoffset: 0, duration: 1.0, ease: "power2.out" }
      );
    }
    if (areaPath) {
      tl.from(areaPath, {
        opacity: 0,
        duration: 0.8,
        ease: "power2.out"
      }, "-=0.6");
    }
    if (points.length) {
      tl.from(points, {
        scale: 0,
        transformOrigin: "center",
        duration: 0.4,
        stagger: 0.05,
        ease: "back.out(1.7)"
      }, "-=0.4");
    }
    if (pointLabels.length) {
      tl.from(pointLabels, {
        opacity: 0,
        y: "+=8",
        duration: 0.4,
        stagger: 0.05,
        ease: "power2.out"
      }, "-=0.3");
    }
    if (xLabels.length) {
      tl.from(xLabels, {
        opacity: 0,
        y: "+=6",
        duration: 0.4,
        stagger: 0.04,
        ease: "power2.out"
      }, "-=0.4");
    }
  }
}

function renderTrendsChart(state) {
  const chartContainer = document.querySelector("[data-trends-chart]");
  if (!chartContainer) return;

  const hotelsData = state.hotels.slice(0, 6).map(hotel => {
    const revenue = state.bookings.reduce((sum, booking) => {
      if (booking.hotelId !== hotel.id || booking.payment !== "paid") return sum;
      return sum + Number(hotel.price || 0) * getBookingNights(booking);
    }, 0);
    return {
      label: shortenHotelName(hotel.name),
      value: revenue
    };
  });

  if (!hotelsData.length) {
    chartContainer.innerHTML = `<div class="empty-state">No hotel data available.</div>`;
    return;
  }

  const maxValue = Math.max(...hotelsData.map(item => item.value), 100);

  // Dimensions
  const width = 800;
  const height = 220;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 25;
  const paddingBottom = 40;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const yBottom = paddingTop + plotHeight;

  // Grid lines
  let gridHtml = "";
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = paddingTop + plotHeight - (plotHeight * (i / gridSteps));
    const val = Math.round(maxValue * (i / gridSteps));
    gridHtml += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4,4" />
      <text x="${paddingLeft - 12}" y="${y + 4}" fill="var(--muted)" font-size="10" font-weight="800" text-anchor="end">$${val}</text>
    `;
  }

  // Draw vertical bars and labels
  const n = hotelsData.length;
  const colWidth = plotWidth / n;
  const barWidth = 46;
  const r = 6; // rounded corner radius

  const barElements = hotelsData.map((item, index) => {
    const colCenter = paddingLeft + (index * colWidth) + (colWidth / 2);
    const barX = colCenter - (barWidth / 2);
    const y = paddingTop + plotHeight - (item.value / maxValue) * plotHeight;
    const barHeight = yBottom - y;

    let barPath = "";
    if (item.value > 0) {
      const radius = Math.min(r, barHeight);
      barPath = `
        <path d="M ${barX} ${yBottom} L ${barX} ${y + radius} Q ${barX} ${y} ${barX + radius} ${y} L ${barX + barWidth - radius} ${y} Q ${barX + barWidth} ${y} ${barX + barWidth} ${y + radius} L ${barX + barWidth} ${yBottom} Z" 
              fill="url(#bar-grad)" 
              class="chart-bar" />
      `;
    }

    const displayVal = formatCurrency(item.value);
    const textY = item.value > 0 ? y - 10 : yBottom - 10;
    const textColor = item.value > 0 ? "var(--primary)" : "var(--muted)";
    const fontWeight = item.value > 0 ? "900" : "700";

    return `
      <g class="chart-bar-group">
        ${barPath}
        <rect x="${barX}" y="${Math.min(y, yBottom - 30)}" width="${barWidth}" height="${Math.max(barHeight, 30)}" fill="transparent" pointer-events="all" style="cursor:pointer;" data-tooltip-title="${item.label}" data-tooltip-value="${displayVal}" />
        <text x="${colCenter}" y="${textY}" fill="${textColor}" font-size="10" font-weight="${fontWeight}" text-anchor="middle" class="chart-bar-label">${displayVal}</text>
        <text x="${colCenter}" y="${height - 15}" fill="var(--muted)" font-size="9" font-weight="800" text-anchor="middle" class="chart-x-label">${item.label}</text>
      </g>
    `;
  }).join("");

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible;">
      <defs>
        <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.85" />
          <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.1" />
        </linearGradient>
        <style>
          .chart-bar {
            transition: all 200ms ease;
          }
          .chart-bar:hover {
            fill: var(--accent);
            filter: drop-shadow(0 0 4px var(--accent-soft));
          }
          .chart-bar-group:hover text.chart-bar-label {
            fill: var(--accent);
            font-size: 11px;
            font-weight: 900;
          }
          .chart-bar-label {
            transition: all 180ms ease;
          }
          .chart-x-label {
            font-weight: 800;
          }
        </style>
      </defs>
      ${gridHtml}
      ${barElements}
    </svg>
  `;

  if (window.gsap) {
    const bars = chartContainer.querySelectorAll(".chart-bar");
    const barLabels = chartContainer.querySelectorAll(".chart-bar-label");
    const xLabels = chartContainer.querySelectorAll(".chart-x-label");

    const tl = window.gsap.timeline();

    if (bars.length) {
      tl.from(bars, {
        scaleY: 0,
        transformOrigin: "bottom center",
        duration: 0.8,
        stagger: 0.08,
        ease: "power2.out"
      });
    }
    if (barLabels.length) {
      tl.from(barLabels, {
        opacity: 0,
        y: "+=12",
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out"
      }, "-=0.6");
    }
    if (xLabels.length) {
      tl.from(xLabels, {
        opacity: 0,
        y: "+=8",
        duration: 0.5,
        stagger: 0.06,
        ease: "power2.out"
      }, "-=0.5");
    }
  }
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

  if (window.gsap) {
    window.gsap.from(chart.querySelector(".donut-chart"), {
      scale: 0,
      opacity: 0,
      rotation: -90,
      duration: 0.8,
      ease: "power2.out"
    });
    window.gsap.from(chart.querySelectorAll(".legend-item"), {
      opacity: 0,
      x: 12,
      duration: 0.4,
      stagger: 0.06,
      ease: "power2.out",
      delay: 0.2
    });
  }
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
    ["Requests", (state.tripBookings || []).length]
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

function initChartTooltips() {
  const tooltip = document.querySelector("[data-chart-tooltip]");
  if (!tooltip) return;

  document.body.addEventListener("mouseover", (e) => {
    const trigger = e.target.closest("[data-tooltip-title]");
    if (!trigger) {
      tooltip.classList.remove("active");
      return;
    }

    const title = trigger.getAttribute("data-tooltip-title");
    const value = trigger.getAttribute("data-tooltip-value");

    tooltip.innerHTML = `
      <strong>${value}</strong>
      <span>${title}</span>
    `;
    tooltip.classList.add("active");
  });

  document.body.addEventListener("mousemove", (e) => {
    if (!tooltip.classList.contains("active")) return;

    tooltip.style.left = `${e.pageX}px`;
    tooltip.style.top = `${e.pageY}px`;
  });

  document.body.addEventListener("mouseout", (e) => {
    const trigger = e.target.closest("[data-tooltip-title]");
    if (trigger) {
      tooltip.classList.remove("active");
    }
  });
}

function renderTransactions(state) {
  const table = document.querySelector("[data-transactions-table]");
  const summaryContainer = document.querySelector("[data-transaction-summary]");
  if (!table) return;

  const transactions = [];

  (state.bookings || []).forEach((booking) => {
    const hotel = findHotel(state, booking.hotelId);
    const user = findUser(state, booking.userId);
    const nights = getBookingNights(booking);
    const totalCost = hotel ? Number(hotel.price || 0) * nights : 0;

    transactions.push({
      id: booking.id,
      itemType: "booking",
      type: "Hotel Stay",
      guestName: user?.name || "Unknown guest",
      guestEmail: user?.email || "",
      guestPhone: user?.phone || "N/A",
      reference: hotel?.name || "Hotel removed",
      detail: `${booking.roomType || "Standard"} / ${booking.checkIn} to ${booking.checkOut}`,
      method: booking.paymentMethod || "N/A",
      transactionId: booking.transactionId || "",
      amount: totalCost,
      status: booking.payment || "pending",
      bookingStatus: booking.status || "pending"
    });
  });

  // Trip bookings
  (state.tripBookings || []).forEach((request) => {
    const user = findUser(state, request.userId);
    const trip = state.trips.find((t) => t.id === request.tripId);
    const totalBudget = trip ? Number(trip.budget || 0) : 0;
    const depositAmount = Math.round(totalBudget * 0.1); // 10% deposit

    transactions.push({
      id: request.id,
      itemType: "tripBooking",
      type: "Trip Plan",
      guestName: user?.name || "Unknown guest",
      guestEmail: user?.email || "",
      guestPhone: user?.phone || "N/A",
      reference: request.tripTitle || "Trip removed",
      detail: `${request.destination || "Destination pending"} / ${request.packageType || "Standard plan"}`,
      method: request.paymentMethod || "N/A",
      transactionId: request.transactionId || "",
      amount: depositAmount,
      status: request.payment || "pending",
      bookingStatus: request.status || "pending"
    });
  });

  transactions.sort((a, b) => b.id.localeCompare(a.id));

  const filtered = transactions.filter((tx) => {
    const search = filters.transactions.search;
    const matchesSearch =
      !search ||
      tx.guestName.toLowerCase().includes(search) ||
      tx.guestEmail.toLowerCase().includes(search) ||
      tx.reference.toLowerCase().includes(search) ||
      tx.transactionId.toLowerCase().includes(search);

    const matchesType =
      filters.transactions.type === "all" ||
      (filters.transactions.type === "hotel" && tx.type === "Hotel Stay") ||
      (filters.transactions.type === "trip" && tx.type === "Trip Plan");

    const matchesMethod =
      filters.transactions.method === "all" ||
      tx.method.toLowerCase() === filters.transactions.method.toLowerCase();

    const matchesStatus =
      filters.transactions.status === "all" ||
      (filters.transactions.status === "paid" && tx.status === "paid") ||
      (filters.transactions.status === "unpaid" && tx.status !== "paid");

    return matchesSearch && matchesType && matchesMethod && matchesStatus;
  });

  // Render summary counts
  if (summaryContainer) {
    const totalAmount = filtered.reduce((sum, tx) => sum + (tx.status === "paid" ? tx.amount : 0), 0);
    const pendingCount = filtered.filter((tx) => tx.status !== "paid").length;
    setSummary("[data-transaction-summary]", [
      ["Filtered transactions", filtered.length],
      ["Pending verification", pendingCount],
      ["Total Paid", formatCurrency(totalAmount)],
      ["Unpaid bookings", filtered.filter((tx) => tx.status !== "paid").length]
    ]);
  }

  // Render table body
  table.innerHTML = filtered.length
    ? filtered
      .map((tx) => {
        const typeClass = tx.type === "Hotel Stay" ? "status-pill planning" : "status-pill in-progress";
        return `
            <tr>
              <td data-label="Type"><span class="${typeClass}">${tx.type}</span></td>
              <td data-label="Guest"><strong>${escapeHtml(tx.guestName)}</strong><br><small>${escapeHtml(tx.guestEmail)}</small></td>
              <td data-label="Reference"><strong>${escapeHtml(tx.reference)}</strong><br><small>${escapeHtml(tx.detail)}</small></td>
              <td data-label="Method"><span class="status-pill">${escapeHtml(tx.method)}</span></td>
              <td data-label="Transaction ID"><code style="font-family: monospace; font-size: 0.88rem; font-weight: bold; color: var(--gold);">${escapeHtml(tx.transactionId || "N/A")}</code></td>
              <td data-label="Amount"><strong>${formatCurrency(tx.amount)}</strong></td>
              <td data-label="Status">${statusPill(tx.status === "paid" ? "paid" : "unpaid")}</td>
              <td data-label="Actions">
                <div class="actions-dropdown-container">
                  <button class="three-dots-btn" type="button" aria-label="Actions">⋮</button>
                  <div class="actions-dropdown-menu" hidden>
                    <button type="button" class="dropdown-item" data-tx-id="${tx.id}" data-tx-item-type="${tx.itemType}" data-tx-action="view">View Details</button>
                    <button type="button" class="dropdown-item" data-tx-id="${tx.id}" data-tx-item-type="${tx.itemType}" data-tx-action="approve" ${tx.bookingStatus === "approved" ? "disabled" : ""}>Approve</button>
                    <button type="button" class="dropdown-item danger" data-tx-id="${tx.id}" data-tx-item-type="${tx.itemType}" data-tx-action="delete">Delete</button>
                  </div>
                </div>
              </td>
            </tr>
          `;
      })
      .join("")
    : `<tr><td colspan="8">No matching transaction records found.</td></tr>`;
}

function renderPaymentMethods(state) {
  const container = document.querySelector("[data-admin-payment-methods]");
  if (!container) return;

  const methods = state.paymentMethods || [];
  container.innerHTML = methods.length
    ? methods
        .map((method) => `
          <div class="compact-item" style="display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; border: 1px solid var(--line); padding: 0.65rem; border-radius: 8px; background: var(--surface);">
            <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
              <div class="payment-logo" style="width: 38px; height: 32px; flex-shrink: 0; background: #fff; border: 1px solid var(--line); border-radius: 6px; display: grid; place-items: center; overflow: hidden;">
                <img src="${escapeHtml(method.logo)}" alt="${escapeHtml(method.name)}" style="width: 80%; max-height: 24px; object-fit: contain;">
              </div>
              <div style="min-width: 0; flex: 1;">
                <h4 style="margin: 0; font-size: 0.82rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text);">${escapeHtml(method.name)}</h4>
                <p style="margin: 0.1rem 0 0; font-size: 0.74rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(method.number)}</p>
              </div>
            </div>
            <div style="display: flex; gap: 0.35rem; flex-shrink: 0;">
              <button class="pill-button" type="button" data-edit-method-id="${method.id}">Edit</button>
              <button class="pill-button delete" type="button" data-delete-method-id="${method.id}">Delete</button>
            </div>
          </div>
        `)
        .join("")
    : `<div class="empty-state">No payment methods configured.</div>`;

  renderTransactionMethodFilter(state);
}

function renderTransactionMethodFilter(state) {
  const select = document.querySelector("[data-filter-transaction-method]");
  if (!select) return;

  const currentSelection = filters.transactions.method;
  let html = `<option value="all">All MFS Methods</option>`;
  const methods = state.paymentMethods || [];
  methods.forEach((m) => {
    html += `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`;
  });
  html += `<option value="N/A">None / N/A</option>`;

  select.innerHTML = html;
  // Restore selection if it still exists, otherwise reset to 'all'
  if ([...select.options].some((opt) => opt.value === currentSelection)) {
    select.value = currentSelection;
  } else {
    select.value = "all";
    filters.transactions.method = "all";
  }
}

