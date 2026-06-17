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
renderHome();
initBookingModal();
initCustomControls();
initNotifications();
initReviewSlider();
initMarquee();
runHomeAnimations();

function renderHome() {
  const state = getState();
  renderHotels(state.hotels.slice(0, 6));
  renderTrips(state.trips);
  updateNotificationDot();
}

function renderHotels(hotels) {
  hotelGrid.innerHTML = hotels
    .map((hotel) => {
      const badge = hotel.rating >= 4.9
        ? { text: "Recommended", class: "recommended" }
        : { text: "Top", class: "top-choice" };
      return `
        <article class="hotel-card reveal">
          <div class="hotel-image">
            <img src="${hotel.image}" alt="${hotel.name}" loading="lazy">
            <div class="hotel-badges-container">
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
  tripList.innerHTML = trips
    .map(
      (trip) => `
        <article class="trip-item reveal">
          <div>
            <h3>${trip.title}</h3>
            <p class="trip-meta">${trip.guest} / ${trip.destination} / ${trip.dates}</p>
          </div>
          ${statusPill(trip.status.toLowerCase().replaceAll(" ", "-"))}
        </article>
      `
    )
    .join("");
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

    updateState((state) => {
      const booking = state.bookings.find((item) => item.id === payButton.dataset.payBooking);
      if (booking) booking.payment = "paid";
    });

    renderNotifications();
    updateNotificationDot();
    showToast("Payment recorded. Admin can verify it in the dashboard.");
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
      const payAction =
        booking.payment === "pending"
          ? `<button class="primary-button compact" type="button" data-pay-booking="${booking.id}">Pay now</button>`
          : `<span class="status-pill paid">Paid</span>`;
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
