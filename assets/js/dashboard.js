import { findHotel, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, formatCurrency, formatStatus, initAuthChrome, initHeader, initTheme, showToast, statusPill, updateUserNavAvatar, userAvatarMarkup } from "./ui.js";

const currentUser = getCurrentUser();
let activeFilter = "all";
let isEditingProfile = false;

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

function getGreeting() {
  const hr = new Date().getHours();
  if (hr < 12) return "Good morning";
  if (hr < 18) return "Good afternoon";
  return "Good evening";
}

function formatDateShort(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function getMembershipBadge(approvedCount) {
  if (approvedCount >= 12) {
    return { label: "AzureStay Diamond Elite", className: "diamond", detail: `${approvedCount} approved stays` };
  }
  if (approvedCount >= 8) {
    return { label: "AzureStay Platinum Elite", className: "platinum", detail: `${approvedCount} approved stays` };
  }
  if (approvedCount >= 5) {
    return { label: "AzureStay Gold", className: "gold", detail: `${approvedCount} approved stays` };
  }
  if (approvedCount >= 2) {
    return { label: "AzureStay Silver", className: "silver", detail: `${approvedCount} approved stays` };
  }
  if (approvedCount === 1) {
    return { label: "AzureStay Bronze", className: "bronze", detail: "1 approved stay" };
  }
  return { label: "AzureStay Starter", className: "starter", detail: "Approve bookings to unlock elite tiers" };
}

function renderDashboard() {
  const state = getState();
  const bookings = (state.bookings || []).filter((booking) => booking.userId === currentUser.id);
  const paid = bookings.filter((booking) => booking.payment === "paid").length;
  const approved = bookings.filter((booking) => booking.status === "approved").length;
  const pending = bookings.filter((booking) => booking.status === "pending").length;
  const membership = getMembershipBadge(approved);

  // Render hero greetings & membership badge
  document.querySelector("[data-dashboard-name]").textContent = `${getGreeting()}, ${currentUser.name}.`;
  document.querySelector("[data-dashboard-tier]").innerHTML = `
    <span class="membership-badge ${membership.className}">${membership.label}</span>
    <span>${membership.detail}</span>
  `;
  document.querySelector("[data-dashboard-subtitle]").textContent = `You have ${bookings.length} stay request${bookings.length === 1 ? "" : "s"} linked to your account.`;

  // Render metric cards with SVGs
  document.querySelector("[data-dashboard-metrics]").innerHTML = [
    [
      "Total bookings",
      bookings.length,
      "All requests",
      "total",
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`
    ],
    [
      "Approved",
      approved,
      "Confirmed stays",
      "approved",
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M8 2v4M16 2v4M3 10h18M21 6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6zM16 14l-4 4-2-2"/></svg>`
    ],
    [
      "Pending",
      pending,
      "Waiting for review",
      "pending",
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`
    ],
    [
      "Paid",
      paid,
      "Payment completed",
      "paid",
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`
    ]
  ]
    .map(
      ([label, value, detail, type, icon]) => `
        <article class="metric-card ${type}">
          <div class="metric-info">
            <span>${label}</span>
            <strong>${value}</strong>
            <small>${detail}</small>
          </div>
          <div class="metric-icon">
            ${icon}
          </div>
        </article>
      `
    )
    .join("");

  // Render profile panel
  renderProfile();

  // Filter bookings
  let filteredBookings = bookings;
  if (activeFilter === "pending") {
    filteredBookings = bookings.filter((b) => b.status === "pending");
  } else if (activeFilter === "approved") {
    filteredBookings = bookings.filter((b) => b.status === "approved");
  } else if (activeFilter === "unpaid") {
    filteredBookings = bookings.filter((b) => b.payment === "pending");
  }

  // Render bookings
  document.querySelector("[data-user-bookings]").innerHTML = filteredBookings.length
    ? filteredBookings.map((booking) => renderBookingCard(state, booking)).join("")
    : renderEmptyBookings(bookings.length);
}

function renderEmptyBookings(totalBookings) {
  const isFiltered = totalBookings > 0;
  return `
    <div class="dashboard-empty-state">
      <div class="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 2v4M16 2v4M3 10h18" />
          <path d="M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="m9 15 2 2 4-5" />
        </svg>
      </div>
      <div>
        <strong>${isFiltered ? "No bookings match this filter" : "No bookings yet"}</strong>
        <p>${isFiltered ? "Try another booking status to see your stay requests." : "Your booking requests will appear here after you request a hotel stay."}</p>
      </div>
      ${isFiltered ? "" : `<a class="primary-button compact" href="hotels.html">Browse hotels</a>`}
    </div>
  `;
}

function renderProfile() {
  const profileContainer = document.querySelector("[data-user-profile]");
  if (!profileContainer) return;
  const avatarStatusText = currentUser.avatar ? "Change photo" : "Upload photo";

  if (!isEditingProfile) {
    profileContainer.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar-container">
          <div class="profile-avatar">${userAvatarMarkup(currentUser, "profile-avatar-image")}</div>
          <div class="profile-avatar-status"></div>
        </div>
        <div class="profile-info-block">
          <div class="profile-field">
            <label>Full Name</label>
            <span>${currentUser.name}</span>
          </div>
          <div class="profile-field">
            <label>Email Address</label>
            <span>${currentUser.email}</span>
          </div>
          <div class="profile-field">
            <label>Phone Number</label>
            <span>${currentUser.phone || "Not set"}</span>
          </div>
          <div class="profile-field">
            <label>Account Role</label>
            <span>User Member</span>
          </div>
          <div class="profile-field">
            <label>Account Status</label>
            <span>${currentUser.status || "Active"}</span>
          </div>
        </div>
        <div class="profile-actions">
          <button class="primary-button compact" type="button" data-edit-profile>Edit Profile</button>
        </div>
      </div>
    `;
  } else {
    profileContainer.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar-container">
          <div class="profile-avatar">${userAvatarMarkup(currentUser, "profile-avatar-image")}</div>
          <div class="profile-avatar-status"></div>
          <label class="profile-avatar-upload" title="${avatarStatusText}" aria-label="${avatarStatusText}">
            <input type="file" accept="image/png,image/jpeg,image/webp" data-profile-image-input />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 8h3l1.6-2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
              <circle cx="12" cy="14" r="3.2" />
            </svg>
          </label>
        </div>
        <form class="profile-info-block" id="profile-edit-form">
          <div class="profile-field editing">
            <label>Full Name</label>
            <input type="text" id="edit-name" value="${currentUser.name}" required />
          </div>
          <div class="profile-field editing">
            <label>Email Address</label>
            <input type="email" id="edit-email" value="${currentUser.email}" required />
          </div>
          <div class="profile-field editing">
            <label>Phone Number</label>
            <input type="text" id="edit-phone" value="${currentUser.phone || ""}" placeholder="+880 1700 000000" />
          </div>
        </form>
        <div class="profile-actions">
          <button class="primary-button compact" type="submit" form="profile-edit-form">Save Changes</button>
          <button class="secondary-button compact" type="button" data-cancel-profile-edit>Cancel</button>
        </div>
      </div>
    `;
  }
}

function renderBookingCard(state, booking) {
  const hotel = findHotel(state, booking.hotelId);
  const hotelImg = hotel?.image || "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=300&q=80";

  // Calculate nights and total price
  const nights = Math.max(
    1,
    Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24))
  );
  const totalCost = nights * (hotel?.price || 0);

  // Stepper timeline calculation
  const step1Class = "completed"; // Booked
  const step2Class = booking.status === "approved" || booking.payment === "paid" ? "completed" : "active"; // Confirmed
  const step3Class = booking.payment === "paid" ? "completed" : booking.status === "approved" ? "active" : "muted"; // Paid

  const conn1Class = booking.status === "approved" || booking.payment === "paid" ? "completed" : "";
  const conn2Class = booking.payment === "paid" ? "completed" : "";

  // Actions
  let actionButtons = "";
  if (booking.payment === "pending") {
    actionButtons += `
      <button class="primary-button compact" type="button" data-dashboard-pay="${booking.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        Pay now
      </button>
    `;
  } else {
    actionButtons += `
      <button class="secondary-button compact" type="button" data-view-receipt="${booking.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        Receipt
      </button>
    `;
  }

  if (booking.status === "pending") {
    actionButtons += `
      <button class="secondary-button compact delete" type="button" data-dashboard-cancel="${booking.id}">
        Cancel Request
      </button>
    `;
  }

  return `
    <article class="user-booking-card" data-booking-id="${booking.id}">
      <div class="booking-image-wrapper">
        <img src="${hotelImg}" alt="${hotel?.name || "Hotel"}" />
      </div>
      <div class="booking-card-main">
        <div class="booking-details-header">
          <div>
            <h3>${hotel?.name || "Hotel removed"}</h3>
            <p class="booking-meta-text">
              ${formatDateShort(booking.checkIn)} – ${formatDateShort(booking.checkOut)} / ${booking.guests} guest${booking.guests === 1 ? "" : "s"} / ${booking.roomType}
            </p>
            <small class="muted">${hotel ? `${hotel.city} / ${formatCurrency(hotel.price)} per night` : "Property unavailable"}</small>
          </div>
          <div class="booking-price-tag">
            <span class="total-price">${formatCurrency(totalCost)}</span>
            <span class="nights-breakdown">${nights} night${nights === 1 ? "" : "s"} stay</span>
          </div>
        </div>

        <div class="booking-stepper">
          <div class="stepper-step ${step1Class}">
            <span class="step-dot"></span>
            <span class="step-label">Booked</span>
          </div>
          <div class="stepper-connector ${conn1Class}"></div>
          <div class="stepper-step ${step2Class}">
            <span class="step-dot"></span>
            <span class="step-label">Confirmed</span>
          </div>
          <div class="stepper-connector ${conn2Class}"></div>
          <div class="stepper-step ${step3Class}">
            <span class="step-dot"></span>
            <span class="step-label">Paid</span>
          </div>
        </div>

        <div class="booking-actions-row">
          ${actionButtons}
        </div>
      </div>
    </article>
  `;
}

function initDashboardActions() {
  // Booking Center Tab Filters
  const filtersWrapper = document.querySelector("[data-booking-filters]");
  if (filtersWrapper) {
    filtersWrapper.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-filter]");
      if (!tab) return;

      filtersWrapper.querySelectorAll("[data-filter]").forEach((btn) => btn.classList.remove("active"));
      tab.classList.add("active");

      activeFilter = tab.dataset.filter;
      renderDashboard();

      // Trigger GSAP fade animation
      if (window.gsap) {
        window.gsap.from(".user-booking-card", {
          opacity: 0,
          y: 10,
          stagger: 0.04,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    });
  }

  // Bookings list interactions (Pay / Cancel / Receipt)
  document.querySelector("[data-user-bookings]").addEventListener("click", (event) => {
    // Pay stay
    const payBtn = event.target.closest("[data-dashboard-pay]");
    if (payBtn) {
      updateState((state) => {
        const booking = state.bookings.find((item) => item.id === payBtn.dataset.dashboardPay);
        if (booking && booking.userId === currentUser.id) {
          booking.payment = "paid";
        }
      });
      renderDashboard();
      showToast("Payment recorded successfully.");
      return;
    }

    // Cancel stay
    const cancelBtn = event.target.closest("[data-dashboard-cancel]");
    if (cancelBtn) {
      if (confirm("Are you sure you want to cancel this booking request?")) {
        updateState((state) => {
          state.bookings = state.bookings.filter((item) => item.id !== cancelBtn.dataset.dashboardCancel);
        });
        renderDashboard();
        showToast("Booking request cancelled.", "warning");
      }
      return;
    }

    // View Receipt modal
    const receiptBtn = event.target.closest("[data-view-receipt]");
    if (receiptBtn) {
      const state = getState();
      const booking = state.bookings.find((item) => item.id === receiptBtn.dataset.viewReceipt);
      if (booking) {
        const hotel = findHotel(state, booking.hotelId);
        if (hotel) {
          const nights = Math.max(
            1,
            Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24))
          );
          const subtotal = nights * hotel.price;
          const tax = subtotal * 0.1; // 10% VAT
          const serviceCharge = subtotal * 0.05; // 5% Service Charge
          const grandTotal = subtotal + tax + serviceCharge;

          document.getElementById("receipt-paper-content").innerHTML = `
            <div class="receipt-header">
              <h3>AzureStay Billing</h3>
              <p>Official stay payment voucher</p>
            </div>
            <div class="receipt-meta-grid">
              <div>
                <span>Invoice Ref</span>
                <strong>INV-${booking.id.toUpperCase()}</strong>
              </div>
              <div>
                <span>Date Paid</span>
                <strong>${new Date(booking.createdAt || Date.now()).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric"
                })}</strong>
              </div>
              <div>
                <span>Guest Name</span>
                <strong>${currentUser.name}</strong>
              </div>
              <div>
                <span>Property Stay</span>
                <strong>${hotel.name}</strong>
              </div>
            </div>
            <table class="receipt-details-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="amount">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${booking.roomType} (${nights} nights)</td>
                  <td class="amount">${formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td>Check-in: ${booking.checkIn}</td>
                  <td></td>
                </tr>
                <tr>
                  <td>Check-out: ${booking.checkOut}</td>
                  <td></td>
                </tr>
                <tr>
                  <td>VAT (10%)</td>
                  <td class="amount">${formatCurrency(tax)}</td>
                </tr>
                <tr>
                  <td>Service Charge (5%)</td>
                  <td class="amount">${formatCurrency(serviceCharge)}</td>
                </tr>
              </tbody>
            </table>
            <div class="receipt-summary-block">
              <div class="receipt-summary-row">
                <span>Subtotal:</span>
                <strong>${formatCurrency(subtotal)}</strong>
              </div>
              <div class="receipt-summary-row total">
                <span>Grand Total Paid:</span>
                <strong>${formatCurrency(grandTotal)}</strong>
              </div>
            </div>
            <div class="receipt-stamp-paid">PAID</div>
            <div class="receipt-footer-msg">
              Thank you for staying with AzureStay. We hope you have an incredible experience. Reference ID: ${booking.id}
            </div>
          `;

          const modal = document.getElementById("receipt-modal");
          modal.classList.add("open");

          // GSAP fade in modal card
          if (window.gsap) {
            window.gsap.fromTo(
              modal.querySelector(".modal-card"),
              { scale: 0.95, opacity: 0 },
              { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(1.2)" }
            );
          }
        }
      }
    }
  });

  // Profile Edit / Toggle Interactions
  const profileContainer = document.querySelector("[data-user-profile]");
  if (profileContainer) {
    profileContainer.addEventListener("change", (event) => {
      const input = event.target.closest("[data-profile-image-input]");
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
          const user = state.users.find((u) => u.id === currentUser.id);
          if (user) {
            user.avatar = avatar;
            currentUser.avatar = avatar;
          }
        });
        renderProfile();
        updateUserNavAvatar(currentUser);
        showToast("Profile image updated.");
      });
      reader.addEventListener("error", () => {
        showToast("Could not read that image file.", "warning");
      });
      reader.readAsDataURL(file);
    });

    profileContainer.addEventListener("click", (event) => {
      // Toggle edit mode
      if (event.target.closest("[data-edit-profile]")) {
        isEditingProfile = true;
        renderProfile();
        return;
      }

      // Cancel edit mode
      if (event.target.closest("[data-cancel-profile-edit]")) {
        isEditingProfile = false;
        renderProfile();
        return;
      }
    });

    // Handle submit profile edit
    profileContainer.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target.closest("#profile-edit-form");
      if (!form) return;

      const editName = document.getElementById("edit-name").value.trim();
      const editEmail = document.getElementById("edit-email").value.trim();
      const editPhone = document.getElementById("edit-phone").value.trim();

      if (!editName || !editEmail) return;

      // Update state
      updateState((state) => {
        const user = state.users.find((u) => u.id === currentUser.id);
        if (user) {
          user.name = editName;
          user.email = editEmail;
          user.phone = editPhone;

          // Update current user values
          currentUser.name = editName;
          currentUser.email = editEmail;
          currentUser.phone = editPhone;
        }
      });

      // Update UI greeting and side panels
      isEditingProfile = false;
      renderDashboard();
      updateUserNavAvatar(currentUser);
      showToast("Profile updated successfully.");
    });
  }

  // Close Receipt Modal
  const modal = document.getElementById("receipt-modal");
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-modal]") || event.target === modal) {
        if (window.gsap) {
          window.gsap.to(modal.querySelector(".modal-card"), {
            scale: 0.95,
            opacity: 0,
            duration: 0.2,
            onComplete: () => {
              modal.classList.remove("open");
            }
          });
        } else {
          modal.classList.remove("open");
        }
      }
    });
  }
}
