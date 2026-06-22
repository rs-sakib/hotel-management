import { createId, getCurrentUser, getState, setCurrentUser, updateState } from "./store.js";
import { animatePage, formatCurrency, initAuthChrome, initHeader, initTheme, showToast } from "./ui.js";
import { initCustomControls } from "./controls.js";

const params = new URLSearchParams(window.location.search);
const tripId = params.get("id");
const detailRoot = document.querySelector("[data-trip-detail]");
const bookingForm = document.querySelector("[data-trip-booking-form]");
const trips = await loadTrips();
const trip = trips.find((item) => item.id === tripId);

initTheme();
initHeader();
initAuthChrome();
initCustomControls();

if (!trip) {
  renderMissingTrip();
} else {
  renderTripDetails();
  initTripBookingForm();
}

animatePage();

async function loadTrips() {
  const response = await fetch("../assets/data/trips.json");
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function renderTripDetails() {
  document.title = `${trip.title} | AzureStay`;
  const status = trip.status.toLowerCase().replaceAll(" ", "-");
  const statusLabel = formatTripStatus(trip.status);

  document.querySelector("[data-trip-image]").src = trip.image;
  document.querySelector("[data-trip-image]").alt = trip.title;
  document.querySelector("[data-trip-type]").textContent = trip.type;
  document.querySelector("[data-trip-status]").textContent = statusLabel;
  document.querySelector("[data-trip-status]").className = `trip-status ${status}`;
  document.querySelector("[data-trip-budget]").textContent = formatCurrency(trip.budget);
  document.querySelector("[data-trip-title]").textContent = trip.title;
  document.querySelector("[data-trip-concierge]").textContent = trip.concierge;
  document.querySelector("[data-booking-price]").innerHTML = `${formatCurrency(trip.budget)} <small>est.</small>`;
  bookingForm.tripId.value = trip.id;

  document.querySelector("[data-trip-facts]").innerHTML = [
    ["Guest", trip.guest],
    ["Destination", trip.destination],
    ["Dates", trip.dates],
    ["Duration", trip.duration],
    ["Hotel stays", String(trip.stays)],
    ["Manager", trip.manager]
  ]
    .map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`)
    .join("");

  document.querySelector("[data-trip-features]").innerHTML = [
    ["Concierge plan", trip.concierge],
    ["Destination", `${trip.destination} / ${trip.duration}`],
    ["Stay coverage", `${Number(trip.stays)} hotel stay${Number(trip.stays) === 1 ? "" : "s"} included in the plan.`],
    ["Operations owner", `${trip.manager} will review and coordinate this request.`]
  ]
    .map(([title, copy]) => `<div class="detail-feature"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></div>`)
    .join("");

  const defaultDate = parseTripStartDate(trip.dates);
  if (defaultDate) {
    bookingForm.preferredDate.value = defaultDate;
  }
}

function initTripBookingForm() {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    let currentUser = getCurrentUser();
    if (!currentUser) {
      setCurrentUser("u-guest");
      currentUser = getState().users.find((user) => user.id === "u-guest");
      showToast("Demo user session started. Your trip request is now linked to the user account.");
    }

    const formData = new FormData(bookingForm);
    updateState((draft) => {
      draft.tripBookings = draft.tripBookings || [];
      if (!draft.trips.some((item) => item.id === trip.id)) {
        draft.trips.unshift({
          id: trip.id,
          title: trip.title,
          guest: trip.guest,
          destination: trip.destination,
          dates: trip.dates,
          status: trip.status
        });
      }
      draft.tripBookings.unshift({
        id: createId("tb"),
        userId: currentUser.id,
        tripId: trip.id,
        tripTitle: trip.title,
        destination: trip.destination,
        preferredDate: formData.get("preferredDate"),
        travelers: Number(formData.get("travelers")),
        packageType: formData.get("packageType"),
        contact: formData.get("contact"),
        note: formData.get("note") || "No special request.",
        status: "pending",
        payment: formData.get("payment"),
        createdAt: new Date().toISOString()
      });
    });

    const preferredDate = bookingForm.preferredDate.value;
    bookingForm.reset();
    bookingForm.tripId.value = trip.id;
    bookingForm.preferredDate.value = preferredDate;
    showToast("Trip request sent to admin for review.");
  });
}

function renderMissingTrip() {
  detailRoot.innerHTML = `
    <section class="access-warning">
      <p class="eyebrow">Trip unavailable</p>
      <h2>We could not find that trip.</h2>
      <p class="muted">The trip may have been removed or the link is missing a trip id.</p>
      <a class="primary-button" href="trips.html">Browse trips</a>
    </section>
  `;
}

function parseTripStartDate(dates) {
  const monthMap = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12"
  };
  const year = String(dates).match(/\d{4}/)?.[0] || "2026";
  const match = String(dates).match(/\b([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (!match || !monthMap[match[1]]) return "";
  return `${year}-${monthMap[match[1]]}-${String(match[2]).padStart(2, "0")}`;
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
