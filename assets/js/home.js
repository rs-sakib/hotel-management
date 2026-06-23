import { createId, findHotel, findUser, getCurrentUser, getState, setCurrentUser, updateState } from "./store.js";
import { animatePage, formatCurrency, formatStatus, initAuthChrome, initHeader, initTheme, showToast, statusPill } from "./ui.js";
import { initCustomControls } from "./controls.js";

const hotelGrid = document.querySelector("[data-hotel-grid]");
const tripList = document.querySelector("[data-trip-list]");
const modal = document.querySelector("[data-booking-modal]");
const bookingForm = document.querySelector("[data-booking-form]");
const notificationPanel = document.querySelector("[data-notification-panel]");
const notificationList = document.querySelector("[data-notification-list]");
const scrim = document.querySelector("[data-scrim]");
const notificationDot = document.querySelector("[data-notification-dot]");

initTheme();
initHeader();
initAuthChrome();
await renderHome();
initBookingModal();
initCustomControls();
initNotifications();
initReviewSlider();
initMarquee();
runHomeAnimations();

async function renderHome() {
  const state = getState();
  renderHotels(state.hotels.slice(0, 6));
  renderTrips((await loadHomeTrips(state.trips)).slice(0, 4));
  updateNotificationDot();
}

async function loadHomeTrips(fallbackTrips = []) {
  try {
    const response = await fetch("assets/data/trips.json");
    if (!response.ok) throw new Error("Trips data unavailable");
    const trips = await response.json();
    return Array.isArray(trips) && trips.length ? trips : fallbackTrips;
  } catch {
    return fallbackTrips;
  }
}

function renderHotels(hotels) {
  const state = getState();
  const currentUser = getCurrentUser();
  const bookings = state.bookings || [];

  hotelGrid.innerHTML = hotels
    .map((hotel) => {
      const badge = hotel.rating >= 4.9
        ? { text: "Recommended", class: "recommended" }
        : { text: "Top", class: "top-choice" };
      const isPending = currentUser && bookings.some((b) => b.hotelId === hotel.id && b.userId === currentUser.id && b.status === "pending");
      const pendingBadge = isPending ? `<span class="glass-tag" style="background: rgba(183, 138, 47, 0.85); border-color: rgba(255, 255, 255, 0.25);">Pending</span>` : "";
      return `
        <article class="hotel-card reveal">
          <div class="hotel-image">
            <img src="${hotel.image}" alt="${hotel.name}" loading="lazy">
            <div class="hotel-badges-container">
              ${pendingBadge}
              <span class="glass-tag ${badge.class}">${badge.text}</span>
              <span class="glass-tag glass-rating-badge">
                <svg class="star-icon" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                <span>${Number(hotel.rating).toFixed(1)}</span>
              </span>
            </div>
          </div>
          <div class="hotel-content">
            <h3>${hotel.name}</h3>
            <p class="muted">${hotel.description}</p>
            <div class="hotel-meta">
              <span>${hotel.city}</span>
              <span>${hotel.rooms} rooms open</span>
            </div>
            <ul class="amenity-list">
              ${hotel.amenities.map((amenity) => `<li>${amenity}</li>`).join("")}
            </ul>
            <div class="hotel-bottom">
              <span class="price">${formatCurrency(hotel.price)} <small>/ night</small></span>
              <div class="hotel-card-actions">
                <a class="primary-button compact" href="pages/hotel-details.html?id=${hotel.id}">Details</a>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTrips(trips) {
  const state = getState();
  const currentUser = getCurrentUser();
  const tripBookings = state.tripBookings || [];

  tripList.innerHTML = trips
    .map((trip, index) => {
      const status = trip.status.toLowerCase().replaceAll(" ", "-");
      const statusLabel = formatTripStatus(trip.status);
      const isPending = currentUser && tripBookings.some((tb) => tb.tripId === trip.id && tb.userId === currentUser.id && tb.status === "pending");
      const pendingBadge = isPending ? `<span class="trip-status pending" style="background: var(--gold); color: #fff; border-color: rgba(255, 255, 255, 0.25);">Pending</span>` : "";
      return `
        <article class="trip-journey-card reveal">
          <div class="trip-visual">
            <img src="${trip.image}" alt="${trip.title}" loading="lazy">
            <span>${trip.type}</span>
          </div>
          <div class="trip-copy">
            <div class="trip-card-head">
              <span class="trip-number">${String(index + 1).padStart(2, "0")}</span>
              ${pendingBadge ? pendingBadge : `<span class="trip-status ${status}">${statusLabel}</span>`}
            </div>
            <h3>${trip.title}</h3>
            <p>${trip.concierge}</p>
            <div class="trip-facts">
              <span>${trip.destination}</span>
              <span>${trip.dates}</span>
              <span>${trip.duration}</span>
              <span>${trip.stays} stay${Number(trip.stays) === 1 ? "" : "s"}</span>
            </div>
            <div class="trip-guest-line">
              <div>
                <strong>${trip.guest}</strong>
                <small>Managed journey</small>
              </div>
              <a class="secondary-button compact trip-details-button" href="pages/trip-details.html?id=${encodeURIComponent(trip.id)}">Details</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function formatTripStatus(status) {
  const labels = {
    Confirmed: "Ready",
    Planning: "Being planned",
    "In progress": "Happening now",
    Completed: "Completed"
  };
  return labels[status] || status;
}

function initBookingModal() {
  hotelGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-book-hotel]");
    if (!button) return;

    const currentUser = getCurrentUser();
    if (!currentUser) {
      setCurrentUser("u-guest");
      showToast("Demo guest session started. You can now request a booking.");
    }

    openBookingModal(button.dataset.bookHotel);
  });

  document.querySelector("[data-modal-close]").addEventListener("click", closeBookingModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeBookingModal();
  });

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);
    const currentUser = getCurrentUser() || getState().users.find((user) => user.id === "u-guest");

    updateState((state) => {
      state.bookings.unshift({
        id: createId("b"),
        userId: currentUser.id,
        hotelId: formData.get("hotelId"),
        checkIn: formData.get("checkIn"),
        checkOut: formData.get("checkOut"),
        guests: Number(formData.get("guests")),
        roomType: formData.get("roomType"),
        note: formData.get("note") || "No special request.",
        status: "pending",
        payment: formData.get("payment"),
        createdAt: new Date().toISOString()
      });
    });

    closeBookingModal();
    renderNotifications();
    updateNotificationDot();
    showToast("Booking request sent to admin for approval.");
  });
}

function openBookingModal(hotelId) {
  const state = getState();
  const hotel = findHotel(state, hotelId);
  if (!hotel) return;

  bookingForm.hotelId.value = hotel.id;
  document.querySelector("[data-modal-hotel-name]").textContent = hotel.name;
  document.querySelector("[data-modal-hotel-meta]").textContent = `${hotel.city} / ${formatCurrency(hotel.price)} per night / ${hotel.rooms} rooms open`;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");

  if (window.gsap) {
    window.gsap.fromTo(".modal-card", { y: 24, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.32, ease: "power3.out" });
  }
}

function closeBookingModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  bookingForm.reset();
}

function initNotifications() {
  document.querySelector("[data-notification-toggle]").addEventListener("click", openNotifications);
  document.querySelector("[data-notification-close]").addEventListener("click", closeNotifications);
  scrim.addEventListener("click", closeNotifications);

  notificationList.addEventListener("click", (event) => {
    const payButton = event.target.closest("[data-pay-booking]");
    if (!payButton) return;
    openPaymentModal(payButton.dataset.payBooking);
  });
}

function openNotifications() {
  renderNotifications();
  notificationPanel.classList.add("open");
  scrim.classList.add("open");
}

function closeNotifications() {
  notificationPanel.classList.remove("open");
  scrim.classList.remove("open");
}

function renderNotifications() {
  const state = getState();
  const currentUser = getCurrentUser();

  if (!currentUser) {
    notificationList.innerHTML = `
      <div class="empty-state">
        Login or request a booking to see booking notifications and payment actions.
      </div>
    `;
    return;
  }

  const bookings = state.bookings.filter((booking) => booking.userId === currentUser.id);
  if (!bookings.length) {
    notificationList.innerHTML = `<div class="empty-state">No booking notifications yet.</div>`;
    return;
  }

  notificationList.innerHTML = bookings
    .map((booking) => {
      const hotel = findHotel(state, booking.hotelId);
      let payAction;
      if (booking.payment === "paid") {
        payAction = `
          <span class="status-pill paid">Paid</span>
          <button class="secondary-button compact" type="button" data-view-notification-ticket="${booking.id}">
            🎫 View Ticket
          </button>
        `;
      } else if (booking.payment === "pending" && booking.transactionId) {
        payAction = `<span class="status-pill pending" style="font-size:0.78rem;">⏳ Awaiting verification</span>`;
      } else if (booking.payment === "rejected") {
        payAction = `
          <span class="status-pill" style="color:#c00;font-size:0.78rem;">✕ Payment rejected</span>
          <button class="primary-button compact" type="button" data-pay-booking="${booking.id}">Retry</button>
        `;
      } else {
        payAction = `<button class="primary-button compact" type="button" data-pay-booking="${booking.id}">Pay now</button>`;
      }
      return `
        <article class="notification-card">
          <strong>${hotel?.name || "Hotel removed"}</strong>
          <p>${booking.checkIn} to ${booking.checkOut} / ${booking.guests} guest(s) / ${booking.roomType}</p>
          <p>Status: ${formatStatus(booking.status)} / Payment: ${formatStatus(booking.payment)}</p>
          <div class="action-row">
            ${statusPill(booking.status)}
            ${payAction}
          </div>
        </article>
      `;
    })
    .join("");
}

function openPaymentModal(bookingId) {
  let overlay = document.getElementById("homePaymentModal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "homePaymentModal";
    overlay.className = "booking-modal";
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="modal-card" style="max-width:460px;width:90%;padding:2rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">
          <h3 style="font-family:var(--font-display);font-size:1.35rem;margin:0;">Complete Payment</h3>
          <button type="button" id="homePayClose" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--muted);">&times;</button>
        </div>
        <p style="color:var(--muted);font-size:0.87rem;margin-bottom:1.1rem;">Send the amount to the MFS account shown below, then enter your transaction ID.</p>
        <div id="homePayMethodList" style="display:grid;gap:0.45rem;margin-bottom:1.1rem;"></div>
        <form id="homePayForm" style="display:grid;gap:0.7rem;">
          <input type="hidden" id="homePayBookingId" />
          <label style="display:flex;flex-direction:column;gap:0.25rem;font-size:0.77rem;font-weight:700;color:var(--muted);">
            Method Used
            <select id="homePayMethod" required style="height:40px;border-radius:8px;border:1px solid var(--line);background:var(--surface-strong);color:var(--text);font-weight:700;font-size:0.87rem;padding:0 0.75rem;"></select>
          </label>
          <label style="display:flex;flex-direction:column;gap:0.25rem;font-size:0.77rem;font-weight:700;color:var(--muted);">
            Transaction ID
            <input type="text" id="homePayTxnId" placeholder="e.g. TXN1234567890" required
              style="height:40px;border-radius:8px;border:1px solid var(--line);background:var(--surface-strong);color:var(--text);font-size:0.87rem;padding:0 0.75rem;" />
          </label>
          <button class="primary-button" type="submit" style="width:100%;height:44px;border-radius:10px;font-size:0.88rem;font-weight:800;">Submit for Admin Verification</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("homePayClose").addEventListener("click", () => overlay.classList.remove("open"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });
    document.getElementById("homePayForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const bId = document.getElementById("homePayBookingId").value;
      const method = document.getElementById("homePayMethod").value;
      const txnId = document.getElementById("homePayTxnId").value.trim();
      if (!txnId) return;
      const currentUser = getCurrentUser();
      updateState((state) => {
        const booking = state.bookings.find((b) => b.id === bId);
        if (booking && booking.userId === currentUser?.id) {
          booking.paymentMethod = method;
          booking.transactionId = txnId;
        }
      });
      overlay.classList.remove("open");
      renderNotifications();
      updateNotificationDot();
      showToast("Payment submitted. Admin will verify shortly.");
    });
    notificationList.addEventListener("click", (e) => {
      const ticketBtn = e.target.closest("[data-view-notification-ticket]");
      if (!ticketBtn) return;
      showNotificationTicket(ticketBtn.dataset.viewNotificationTicket);
    });
  }

  document.getElementById("homePayBookingId").value = bookingId;
  document.getElementById("homePayTxnId").value = "";
  const state = getState();
  const methods = state.paymentMethods || [];
  document.getElementById("homePayMethod").innerHTML =
    methods.map((m) => `<option value="${m.name}">${m.name}</option>`).join("") ||
    `<option value="N/A">No methods configured</option>`;
  document.getElementById("homePayMethodList").innerHTML = methods.length
    ? methods.map((m) => `
        <div style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.7rem;border:1px solid var(--line);border-radius:8px;background:var(--surface);">
          <img src="${m.logo}" alt="${m.name}" style="width:34px;height:26px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:4px;padding:2px;" />
          <div><strong style="font-size:0.8rem;display:block;">${m.name}</strong><span style="font-size:0.76rem;color:var(--muted);font-family:monospace;">${m.number}</span></div>
        </div>`).join("")
    : `<p style="font-size:0.8rem;color:var(--muted);">No payment methods configured yet.</p>`;

  overlay.classList.add("open");
  if (window.gsap) {
    window.gsap.fromTo(overlay.querySelector(".modal-card"),
      { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(1.2)" });
  }
}

function showNotificationTicket(bookingId) {
  const state = getState();
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return;
  const hotel = findHotel(state, booking.hotelId);
  if (!hotel) return;
  const nights = Math.max(1, Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)));
  const totalCost = nights * hotel.price;
  const currentUser = getCurrentUser();

  let overlay = document.getElementById("notifTicketModal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "notifTicketModal";
    overlay.className = "booking-modal";
    overlay.innerHTML = `
      <div class="modal-card" id="notifTicketCard" style="max-width:430px;width:90%;padding:0;overflow:hidden;border-radius:16px;">
        <div id="notifTicketContent"></div>
        <div style="padding:1rem 1.5rem;display:flex;gap:0.75rem;border-top:1px solid var(--line);">
          <button class="primary-button compact" onclick="window.print()" style="flex:1;">🖨 Print</button>
          <button class="secondary-button compact" id="notifTicketClose" style="flex:1;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("notifTicketClose").addEventListener("click", () => overlay.classList.remove("open"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });
  }

  document.getElementById("notifTicketContent").innerHTML = `
    <div style="background:linear-gradient(135deg,var(--primary,#1a6b4a) 0%,#0d4a33 100%);padding:1.6rem 1.4rem 1.1rem;color:#fff;">
      <p style="font-size:0.68rem;letter-spacing:0.12em;opacity:0.75;margin:0 0 0.2rem;">AZURESTAY — BOOKING TICKET</p>
      <h2 style="margin:0;font-family:var(--font-display,serif);font-size:1.35rem;">${hotel.name}</h2>
      <p style="margin:0.25rem 0 0;font-size:0.8rem;opacity:0.8;">${hotel.city} &nbsp;·&nbsp; <span style="background:rgba(255,255,255,0.2);padding:0.15rem 0.5rem;border-radius:4px;font-size:0.68rem;font-weight:800;">✓ CONFIRMED</span></p>
    </div>
    <div style="padding:1.1rem 1.4rem;display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;border-bottom:2px dashed var(--line);">
      <div style="background:var(--surface);border-radius:8px;padding:0.55rem 0.7rem;">
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:700;">GUEST</p>
        <p style="margin:0.1rem 0 0;font-size:0.85rem;font-weight:800;">${currentUser?.name || "Guest"}</p>
      </div>
      <div style="background:var(--surface);border-radius:8px;padding:0.55rem 0.7rem;">
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:700;">ROOM</p>
        <p style="margin:0.1rem 0 0;font-size:0.85rem;font-weight:800;">${booking.roomType}</p>
      </div>
      <div style="background:var(--surface);border-radius:8px;padding:0.55rem 0.7rem;">
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:700;">CHECK-IN</p>
        <p style="margin:0.1rem 0 0;font-size:0.85rem;font-weight:800;">${booking.checkIn}</p>
      </div>
      <div style="background:var(--surface);border-radius:8px;padding:0.55rem 0.7rem;">
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:700;">CHECK-OUT</p>
        <p style="margin:0.1rem 0 0;font-size:0.85rem;font-weight:800;">${booking.checkOut}</p>
      </div>
      <div style="background:var(--surface);border-radius:8px;padding:0.55rem 0.7rem;">
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:700;">GUESTS</p>
        <p style="margin:0.1rem 0 0;font-size:0.85rem;font-weight:800;">${booking.guests}</p>
      </div>
      <div style="background:var(--surface);border-radius:8px;padding:0.55rem 0.7rem;">
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:700;">NIGHTS</p>
        <p style="margin:0.1rem 0 0;font-size:0.85rem;font-weight:800;">${nights}</p>
      </div>
    </div>
    <div style="padding:0.9rem 1.4rem;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:700;">TOTAL PAID</p>
        <p style="margin:0.1rem 0 0;font-size:1.25rem;font-weight:900;color:var(--primary);">BDT ${totalCost.toLocaleString()}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:0.65rem;color:var(--muted);font-weight:700;">REF. ID</p>
        <p style="margin:0.1rem 0 0;font-size:0.72rem;font-family:monospace;font-weight:800;color:var(--gold);">${booking.id.toUpperCase()}</p>
      </div>
    </div>
  `;

  overlay.classList.add("open");
  if (window.gsap) {
    window.gsap.fromTo(document.getElementById("notifTicketCard"),
      { scale: 0.9, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.4)" });
  }

function updateNotificationDot() {
  const currentUser = getCurrentUser();
  const state = getState();
  const hasAction = currentUser && state.bookings.some((booking) => booking.userId === currentUser.id && (booking.status === "approved" || booking.payment === "pending"));
  notificationDot.classList.toggle("active", Boolean(hasAction));
}

function initReviewSlider() {
  const slider = document.querySelector("[data-review-swiper]");
  if (!slider) return;

  if (!window.Swiper) {
    initFallbackReviewSlider(slider);
    return;
  }

  new window.Swiper("[data-review-swiper]", {
    loop: true,
    speed: 650,
    spaceBetween: 14,
    grabCursor: true,
    autoplay: {
      delay: 3600,
      disableOnInteraction: false
    },
    pagination: {
      el: ".reviews-section .swiper-pagination",
      clickable: true
    },
    navigation: {
      nextEl: ".reviews-section .review-next",
      prevEl: ".reviews-section .review-prev"
    },
    breakpoints: {
      0: {
        slidesPerView: 1
      },
      740: {
        slidesPerView: 2
      },
      1060: {
        slidesPerView: 3
      }
    }
  });
}

function initFallbackReviewSlider(slider) {
  const wrapper = slider.querySelector(".swiper-wrapper");
  const slides = [...slider.querySelectorAll(".swiper-slide")];
  const prevButton = slider.querySelector(".review-prev");
  const nextButton = slider.querySelector(".review-next");
  const pagination = slider.querySelector(".swiper-pagination");
  let index = 0;

  slider.classList.add("fallback-swiper");
  pagination.innerHTML = slides.map((_, itemIndex) => `<button type="button" aria-label="Go to review ${itemIndex + 1}" data-review-dot="${itemIndex}"></button>`).join("");

  const render = () => {
    wrapper.style.transform = `translateX(-${index * 100}%)`;
    pagination.querySelectorAll("[data-review-dot]").forEach((dot, itemIndex) => {
      dot.classList.toggle("active", itemIndex === index);
    });
  };

  prevButton.addEventListener("click", () => {
    index = (index - 1 + slides.length) % slides.length;
    render();
  });

  nextButton.addEventListener("click", () => {
    index = (index + 1) % slides.length;
    render();
  });

  pagination.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-review-dot]");
    if (!dot) return;
    index = Number(dot.dataset.reviewDot);
    render();
  });

  window.setInterval(() => {
    index = (index + 1) % slides.length;
    render();
  }, 3600);

  render();
}

function initMarquee() {
  document.querySelectorAll("[data-marquee-track]").forEach((track) => {
    const group = track.querySelector(".marquee-group");
    if (!group || track.dataset.cloned === "true") return;

    const clone = group.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    track.append(clone);
    track.dataset.cloned = "true";
  });
}

function runHomeAnimations() {
  animatePage();

  if (!window.gsap) return;
  const gsap = window.gsap;

  if (window.ScrollTrigger) {
    gsap.registerPlugin(window.ScrollTrigger);
  }

  gsap.from(".hero-media img", { scale: 1.12, duration: 1.4, ease: "power3.out" });
  gsap.from(".hero .reveal", { y: 34, opacity: 0, duration: 0.75, stagger: 0.11, ease: "power3.out" });

  gsap.utils.toArray(".reveal:not(.hero .reveal)").forEach((item) => {
    gsap.from(item, {
      y: 28,
      opacity: 0,
      duration: 0.65,
      ease: "power3.out",
      scrollTrigger: {
        trigger: item,
        start: "top 86%"
      }
    });
  });

  gsap.utils.toArray("[data-count]").forEach((counter) => {
    const target = Number(counter.dataset.count);
    gsap.to(counter, {
      textContent: target,
      duration: 1.4,
      ease: "power2.out",
      snap: { textContent: 1 },
      onUpdate: () => {
        counter.textContent = Math.round(Number(counter.textContent)).toLocaleString();
      }
    });
  });
}
