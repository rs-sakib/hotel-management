import { findHotel, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animateCounters, animatePage, counterValueMarkup, formatCurrency, formatStatus, initAuthChrome, initHeader, initTheme, showToast, statusPill, updateUserNavAvatar, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

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
  const metricsRoot = document.querySelector("[data-dashboard-metrics]");
  if (!metricsRoot) return;
  metricsRoot.innerHTML = [
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
            <strong>${counterValueMarkup(value)}</strong>
            <small>${detail}</small>
          </div>
          <div class="metric-icon">
            ${icon}
          </div>
        </article>
      `
    )
    .join("");
  animateCounters(metricsRoot);

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
  if (booking.payment === "pending" && !booking.transactionId) {
    // No payment info submitted yet
    actionButtons += `
      <button class="primary-button compact" type="button" data-dashboard-pay="${booking.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        Pay now
      </button>
    `;
  } else if (booking.payment === "pending" && booking.transactionId) {
    // Submitted, waiting admin verification
    actionButtons += `
      <span class="status-pill pending" style="font-size:0.78rem;display:inline-flex;align-items:center;gap:0.25rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Awaiting verification
      </span>
    `;
  } else if (booking.payment === "paid") {
    // Admin approved — show ticket
    actionButtons += `
      <button class="primary-button compact" type="button" data-view-ticket="${booking.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>
        View Ticket
      </button>
    `;
    actionButtons += `
      <button class="secondary-button compact" type="button" data-view-receipt="${booking.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        Receipt
      </button>
    `;
  } else if (booking.payment === "rejected") {
    actionButtons += `
      <span class="status-pill" style="color:#be3d3d;background:rgba(190,61,61,0.08);border:1px solid rgba(190,61,61,0.15);font-size:0.78rem;display:inline-flex;align-items:center;gap:0.25rem;margin-right:0.5rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Payment rejected
      </span>
    `;
    actionButtons += `
      <button class="primary-button compact" type="button" data-dashboard-pay="${booking.id}">
        Retry Payment
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
    // Pay stay — open payment modal
    const payBtn = event.target.closest("[data-dashboard-pay]");
    if (payBtn) {
      showPaymentModal(payBtn.dataset.dashboardPay);
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
    // View Ticket modal (when payment is approved)
    const ticketBtn = event.target.closest("[data-view-ticket]");
    if (ticketBtn) {
      showTicketModal(ticketBtn.dataset.viewTicket);
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

// ─── Payment Modal ───────────────────────────────────────────────────────────
function showPaymentModal(bookingId) {
  let overlay = document.getElementById("paymentModal");
  const isNew = !overlay;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "paymentModal";
    overlay.className = "modal";
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="modal-card" style="max-width:480px;width:90%;padding:2rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">
          <h3 style="font-family:var(--font-display);font-size:1.4rem;margin:0;">Complete Payment</h3>
          <button type="button" id="payModalClose" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--muted);">&times;</button>
        </div>
        <p style="color:var(--muted);font-size:0.88rem;margin-bottom:1.25rem;">Send the full amount to the hotel's MFS account below, then enter your transaction details.</p>
        <div id="payMethodList" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1.25rem;"></div>
        <form id="paymentForm" style="display:grid;gap:0.75rem;">
          <input type="hidden" id="payBookingId" />
          <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.78rem;font-weight:700;color:var(--muted);">
            Payment Method Used
            <select id="payMethodSelect" required style="height:40px;border-radius:8px;border:1px solid var(--line);background:var(--surface-strong);color:var(--text);font-weight:700;font-size:0.88rem;padding:0 0.75rem;"></select>
          </label>
          <label style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.78rem;font-weight:700;color:var(--muted);">
            Transaction ID
            <input type="text" id="payTxnId" placeholder="Enter the txn ID from your MFS app" required style="height:40px;border-radius:8px;border:1px solid var(--line);background:var(--surface-strong);color:var(--text);font-size:0.88rem;padding:0 0.75rem;" />
          </label>
          <button class="primary-button" type="submit" style="width:100%;height:44px;border-radius:10px;font-size:0.9rem;font-weight:800;margin-top:0.25rem;">Submit Payment for Verification</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("payModalClose").addEventListener("click", () => overlay.classList.remove("open"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });
    document.getElementById("paymentForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const bId = document.getElementById("payBookingId").value;
      const method = document.getElementById("payMethodSelect").value;
      const txnId = document.getElementById("payTxnId").value.trim();
      if (!txnId) return;
      updateState((state) => {
        const booking = state.bookings.find((b) => b.id === bId);
        if (booking && booking.userId === currentUser.id) {
          booking.paymentMethod = method;
          booking.transactionId = txnId;
          // payment stays "pending" — admin must verify
        }
      });
      overlay.classList.remove("open");
      renderDashboard();
      showToast("Payment details submitted. Awaiting admin verification.");
    });
  }

  // Populate data
  document.getElementById("payBookingId").value = bookingId;
  document.getElementById("payTxnId").value = "";
  const state = getState();
  const methods = state.paymentMethods || [];
  const methodSelect = document.getElementById("payMethodSelect");
  methodSelect.innerHTML = methods.map((m) => `<option value="${m.name}">${m.name}</option>`).join("") ||
    `<option value="N/A">No methods configured</option>`;

  if (isNew) {
    initCustomControls(overlay);
  }

  // Show payment method numbers
  document.getElementById("payMethodList").innerHTML = methods.length
    ? methods.map((m) => `
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.55rem;border:1px solid var(--line);border-radius:8px;background:var(--surface);cursor:pointer;" class="pay-method-card" data-method-name="${m.name}">
          <img src="${m.logo}" alt="${m.name}" style="width:30px;height:22px;object-fit:contain;border-radius:4px;background:#fff;border:1px solid var(--line);padding:1px;" />
          <div style="min-width:0;flex:1;">
            <strong style="font-size:0.76rem;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.name}</strong>
            <span style="font-size:0.7rem;color:var(--muted);font-family:monospace;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.number}</span>
          </div>
        </div>`).join("")
    : `<p style="font-size:0.82rem;color:var(--muted);">No payment methods configured by admin yet.</p>`;

  overlay.querySelectorAll(".pay-method-card").forEach((card) => {
    card.addEventListener("click", () => {
      const select = document.getElementById("payMethodSelect");
      select.value = card.dataset.methodName;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  overlay.classList.add("open");
  if (window.gsap) {
    window.gsap.fromTo(overlay.querySelector(".modal-card"),
      { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(1.2)" });
  }
}

// ─── Ticket Modal ─────────────────────────────────────────────────────────────
function showTicketModal(bookingId) {
  const state = getState();
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return;
  const hotel = findHotel(state, booking.hotelId);
  if (!hotel) return;
  const nights = Math.max(1, Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)));
  const totalCost = nights * hotel.price;

  let overlay = document.getElementById("ticketModal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "ticketModal";
    overlay.className = "modal";
    overlay.innerHTML = `
      <div class="modal-card" id="ticketCard" style="max-width:430px;width:90%;padding:0;overflow:hidden;border-radius:16px;">
        <div id="ticketContent"></div>
        <div class="no-print" style="padding:1rem 1.5rem;display:flex;gap:0.75rem;border-top:1px solid var(--line);">
          <button class="primary-button compact" onclick="window.print()" style="flex:1;display:inline-flex;align-items:center;gap:0.35rem;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button class="secondary-button compact" id="ticketClose" style="flex:1;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("ticketClose").addEventListener("click", () => overlay.classList.remove("open"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });
  }

  document.getElementById("ticketContent").innerHTML = `
    <div style="background:linear-gradient(135deg, #0b6d64 0%, #053b36 100%);padding:1.8rem 1.5rem 1.3rem;color:#fff;position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <p style="font-size:0.68rem;letter-spacing:0.12em;opacity:0.85;margin:0 0 0.3rem;font-weight:700;">AZURESTAY — BOARDING PASS</p>
          <h2 style="margin:0;font-family:var(--font-display,serif);font-size:1.45rem;letter-spacing:-0.01em;font-weight:800;">${hotel.name}</h2>
          <p style="margin:0.2rem 0 0;font-size:0.8rem;opacity:0.85;display:flex;align-items:center;gap:0.3rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;color:rgba(255,255,255,0.7);"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
            ${hotel.city}
          </p>
        </div>
        <div style="text-align:right;">
          <div style="background:#ffffff;color:#0b6d64;border-radius:30px;padding:0.4rem 0.75rem;font-size:0.68rem;font-weight:900;letter-spacing:0.06em;display:inline-flex;align-items:center;gap:0.3rem;box-shadow:0 4px 12px rgba(0,0,0,0.12);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:10px;height:10px;color:#0b6d64;"><polyline points="20 6 9 17 4 12"/></svg>
            CONFIRMED
          </div>
        </div>
      </div>
    </div>
    <div style="padding:1.3rem 1.5rem 1rem;display:grid;gap:0.65rem;border-bottom:2px dashed rgba(11, 109, 100, 0.16);position:relative;background:#fafcfb;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem;">
        <div style="background:rgba(11, 109, 100, 0.05);border:1px solid rgba(11, 109, 100, 0.08);border-radius:8px;padding:0.55rem 0.7rem;">
          <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:800;letter-spacing:0.04em;">GUEST</p>
          <p style="margin:0.15rem 0 0;font-size:0.85rem;font-weight:800;color:var(--text);">${currentUser?.name || "Guest"}</p>
        </div>
        <div style="background:rgba(11, 109, 100, 0.05);border:1px solid rgba(11, 109, 100, 0.08);border-radius:8px;padding:0.55rem 0.7rem;">
          <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:800;letter-spacing:0.04em;">ROOM TYPE</p>
          <p style="margin:0.15rem 0 0;font-size:0.85rem;font-weight:800;color:var(--text);">${booking.roomType}</p>
        </div>
        <div style="background:rgba(11, 109, 100, 0.05);border:1px solid rgba(11, 109, 100, 0.08);border-radius:8px;padding:0.55rem 0.7rem;">
          <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:800;letter-spacing:0.04em;">CHECK-IN</p>
          <p style="margin:0.15rem 0 0;font-size:0.85rem;font-weight:800;color:var(--text);">${booking.checkIn}</p>
        </div>
        <div style="background:rgba(11, 109, 100, 0.05);border:1px solid rgba(11, 109, 100, 0.08);border-radius:8px;padding:0.55rem 0.7rem;">
          <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:800;letter-spacing:0.04em;">CHECK-OUT</p>
          <p style="margin:0.15rem 0 0;font-size:0.85rem;font-weight:800;color:var(--text);">${booking.checkOut}</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem;">
        <div style="background:rgba(11, 109, 100, 0.05);border:1px solid rgba(11, 109, 100, 0.08);border-radius:8px;padding:0.55rem 0.7rem;">
          <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:800;letter-spacing:0.04em;">GUESTS</p>
          <p style="margin:0.15rem 0 0;font-size:0.85rem;font-weight:800;color:var(--text);">${booking.guests} traveler(s)</p>
        </div>
        <div style="background:rgba(11, 109, 100, 0.05);border:1px solid rgba(11, 109, 100, 0.08);border-radius:8px;padding:0.55rem 0.7rem;">
          <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:800;letter-spacing:0.04em;">DURATION</p>
          <p style="margin:0.15rem 0 0;font-size:0.85rem;font-weight:800;color:var(--text);">${nights} night(s) stay</p>
        </div>
      </div>
    </div>
    <div style="padding:1.1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;background:#f6faf8;">
      <div>
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:800;letter-spacing:0.04em;">TOTAL PAID</p>
        <p style="margin:0.15rem 0 0;font-size:1.3rem;font-weight:900;color:#0b6d64;font-family:var(--font-price);">BDT ${totalCost.toLocaleString()}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:800;letter-spacing:0.04em;">REF. ID</p>
        <p style="margin:0.15rem 0 0;font-size:0.75rem;font-weight:800;font-family:monospace;color:var(--gold);">${booking.id.toUpperCase()}</p>
      </div>
    </div>
    <!-- Barcode simulation decoration -->
    <div style="background:#f6faf8;padding:0 1.5rem 1rem;text-align:center;">
      <div style="display:flex;gap:1.5px;height:30px;opacity:0.55;justify-content:center;margin:0 auto 0.2rem;width:80%;">
        <div style="width:2px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:3px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:2px;background:#000;"></div>
        <div style="width:4px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:2px;background:#000;"></div>
        <div style="width:3px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:2px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:4px;background:#000;"></div>
        <div style="width:2px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:3px;background:#000;"></div>
        <div style="width:2px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:4px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:2px;background:#000;"></div>
        <div style="width:3px;background:#000;"></div>
        <div style="width:1px;background:#000;"></div>
        <div style="width:2px;background:#000;"></div>
      </div>
      <span style="font-size:0.6rem;font-family:monospace;letter-spacing:0.25em;color:var(--muted);text-transform:uppercase;">*${booking.id.toUpperCase()}*</span>
    </div>
  `;

  overlay.classList.add("open");
  if (window.gsap) {
    window.gsap.fromTo(document.getElementById("ticketCard"),
      { scale: 0.9, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.4)" });
  }
}
