import { createId, findHotel, getCurrentUser, getState, setCurrentUser, updateState } from "./store.js";
import { animatePage, formatCurrency, initAuthChrome, initHeader, initTheme, showToast } from "./ui.js";
import { initCustomControls } from "./controls.js";

const params = new URLSearchParams(window.location.search);
const hotelId = params.get("id");
const state = getState();
const hotel = findHotel(state, hotelId);
const detailRoot = document.querySelector("[data-hotel-detail]");
const bookingForm = document.querySelector("[data-detail-booking-form]");

initTheme();
initHeader();
initAuthChrome();
initCustomControls();

if (!hotel) {
  renderMissingHotel();
} else {
  renderHotelDetails();
  initBookingForm();
}

animatePage();

function renderHotelDetails() {
  document.title = `${hotel.name} | AzureStay`;
  document.querySelector("[data-detail-image]").src = hotel.image;
  document.querySelector("[data-detail-image]").alt = hotel.name;
  document.querySelector("[data-detail-location]").textContent = hotel.city;
  document.querySelector("[data-detail-name]").textContent = hotel.name;
  document.querySelector("[data-detail-description]").textContent = hotel.description;
  document.querySelector("[data-detail-price]").innerHTML = `${formatCurrency(hotel.price)} <small>/ night</small>`;
  bookingForm.hotelId.value = hotel.id;

  document.querySelector("[data-detail-meta]").innerHTML = `
    <span>${hotel.rating} rating</span>
    <span>${hotel.rooms} rooms open</span>
    <span>${formatCurrency(hotel.price)} average nightly rate</span>
  `;

  document.querySelector("[data-detail-amenities]").innerHTML = hotel.amenities.map((amenity) => `<li>${amenity}</li>`).join("");

  const features = [
    ["Guest profile", "Room preferences, payment status, and special notes stay attached to every request."],
    ["Front desk ready", `${hotel.rooms} available rooms can be tracked by admins for approvals and arrival planning.`],
    ["Service match", hotel.amenities.join(", ")],
    ["Location context", `${hotel.city} with a ${hotel.rating} guest satisfaction rating.`]
  ];

  document.querySelector("[data-detail-features]").innerHTML = features
    .map(
      ([title, copy]) => `
        <div class="detail-feature">
          <strong>${title}</strong>
          <span>${copy}</span>
        </div>
      `
    )
    .join("");
}

function initBookingForm() {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    let currentUser = getCurrentUser();
    if (!currentUser) {
      setCurrentUser("u-guest");
      currentUser = getState().users.find((user) => user.id === "u-guest");
      showToast("Demo guest session started. Your request will appear in the guest dashboard.");
    }

    const formData = new FormData(bookingForm);
    updateState((draft) => {
      draft.bookings.unshift({
        id: createId("b"),
        userId: currentUser.id,
        hotelId: hotel.id,
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

    bookingForm.reset();
    bookingForm.hotelId.value = hotel.id;
    showToast("Booking request sent to admin for approval.");
  });
}

function renderMissingHotel() {
  detailRoot.innerHTML = `
    <section class="access-warning">
      <p class="eyebrow">Hotel unavailable</p>
      <h2>We could not find that hotel.</h2>
      <p class="muted">The property may have been removed or the link is missing a hotel id.</p>
      <a class="primary-button" href="../index.html#hotels">Browse hotels</a>
    </section>
  `;
}
