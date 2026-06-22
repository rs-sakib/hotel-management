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

  const finalAvailabilityDate = getTripEndDateLabel(trip.dates);
  document.querySelector("[data-trip-facts]").innerHTML = [
    ["Trip category", trip.type],
    ["Destination", trip.destination],
    ["Final availability", finalAvailabilityDate],
    ["Trip duration", trip.duration],
    ["Included stays", String(trip.stays)],
    ["Managed by", trip.manager]
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
  // Get DOM elements for dynamic payment display
  const paymentChoiceRadios = bookingForm.querySelectorAll('input[name="payment"]');
  const paymentMethodsFieldset = bookingForm.querySelector('.payment-methods');
  const depositAmountVal = bookingForm.querySelector('#depositAmountVal');
  const merchantNumberVal = bookingForm.querySelector('#merchantNumberVal');
  const transactionIdInput = bookingForm.querySelector('#transactionId');
  const methodGrid = bookingForm.querySelector("#paymentMethodGrid");

  // Load dynamic payment methods from state
  const state = getState();
  const methods = state.paymentMethods || [];
  const currentUser = getCurrentUser();
  const hasPendingRequest = currentUser && (state.tripBookings || []).some(
    (tb) => tb.tripId === trip.id && tb.userId === currentUser.id && tb.status === "pending"
  );

  // Render methods dynamically
  if (methodGrid) {
    if (methods.length > 0) {
      methodGrid.innerHTML = methods.map((method, index) => `
        <label class="payment-method-card ${index === 0 ? 'selected' : ''}">
          <input type="radio" name="paymentMethod" value="${escapeHtml(method.name)}" ${index === 0 ? 'checked' : ''} />
          <div class="method-logo-wrap">
            <img src="${escapeHtml(method.logo)}" alt="${escapeHtml(method.name)}" />
          </div>
          <span class="method-name">${escapeHtml(method.name)}</span>
        </label>
      `).join("");
    } else {
      methodGrid.innerHTML = `<div class="payment-info-note full-span">No payment methods configured by admin. Please contact support.</div>`;
    }
  }

  if (hasPendingRequest) {
    const submitBtn = bookingForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Request Pending Approval";
      submitBtn.style.background = "var(--muted)";
      submitBtn.style.cursor = "not-allowed";
    }

    const warningMsg = document.createElement("div");
    warningMsg.className = "payment-info-box full-span";
    warningMsg.style.borderColor = "var(--gold)";
    warningMsg.style.background = "var(--primary-soft)";
    warningMsg.style.marginTop = "0";
    warningMsg.style.marginBottom = "1rem";
    warningMsg.innerHTML = `
      <div class="payment-info-row">
        <strong style="color: var(--gold); font-weight: 800;">Pending Request</strong>
      </div>
      <p class="payment-info-note" style="color: var(--text);">
        You already have a pending trip request for this destination. You cannot submit another request until the administrator reviews your pending application.
      </p>
    `;
    const formGrid = bookingForm.querySelector(".form-grid");
    if (formGrid) {
      formGrid.insertBefore(warningMsg, formGrid.firstChild);
    }

    bookingForm.querySelectorAll("input, select, textarea").forEach((input) => {
      input.disabled = true;
    });
  }

  function updatePaymentUI() {
    const selectedRadio = bookingForm.querySelector('input[name="payment"]:checked');
    const isPaid = selectedRadio && selectedRadio.value === "paid";
    if (isPaid) {
      if (paymentMethodsFieldset) paymentMethodsFieldset.style.display = "block";
      if (transactionIdInput) transactionIdInput.setAttribute("required", "");
    } else {
      if (paymentMethodsFieldset) paymentMethodsFieldset.style.display = "none";
      if (transactionIdInput) transactionIdInput.removeAttribute("required");
    }
  }

  function updateMerchantNumber() {
    const selectedRadio = bookingForm.querySelector('input[name="paymentMethod"]:checked');
    if (!selectedRadio) {
      if (merchantNumberVal) merchantNumberVal.textContent = "N/A";
      return;
    }
    const methodName = selectedRadio.value;
    const method = methods.find((m) => m.name === methodName);
    if (merchantNumberVal) {
      merchantNumberVal.textContent = method ? method.number : "N/A";
    }
  }

  // Set deposit amount (10% of estimated budget)
  if (depositAmountVal && trip && trip.budget) {
    const depositAmount = Math.round(Number(trip.budget) * 0.1);
    depositAmountVal.textContent = formatCurrency(depositAmount);
  }

  paymentChoiceRadios.forEach((radio) => radio.addEventListener("change", updatePaymentUI));

  if (methodGrid) {
    methodGrid.addEventListener("change", (e) => {
      if (e.target.name === "paymentMethod") {
        methodGrid.querySelectorAll(".payment-method-card").forEach((card) => {
          card.classList.remove("selected");
        });
        const activeCard = e.target.closest(".payment-method-card");
        if (activeCard) {
          activeCard.classList.add("selected");
        }
        updateMerchantNumber();
      }
    });
  }

  // Initialize UI state
  updatePaymentUI();
  updateMerchantNumber();

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    let currentUser = getCurrentUser();
    if (!currentUser) {
      setCurrentUser("u-guest");
      currentUser = getState().users.find((user) => user.id === "u-guest");
      showToast("Demo user session started. Your trip request is now linked to the user account.");
    }

    const formData = new FormData(bookingForm);
    const paymentChoice = formData.get("payment");

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
        payment: paymentChoice,
        paymentMethod: paymentChoice === "paid" ? formData.get("paymentMethod") : "N/A",
        transactionId: paymentChoice === "paid" ? (formData.get("transactionId") || "").trim() : "",
        createdAt: new Date().toISOString()
      });
    });

    const preferredDate = bookingForm.preferredDate.value;
    bookingForm.reset();
    bookingForm.tripId.value = trip.id;
    bookingForm.preferredDate.value = preferredDate;
    updatePaymentUI();
    updateMerchantNumber();
    showToast("Trip request sent to admin for review.");
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1500);
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

function getTripEndDateLabel(dates) {
  const year = String(dates).match(/\d{4}/)?.[0] || "2026";
  const compactRange = String(dates).match(/\b([A-Z][a-z]{2})\s+(\d{1,2})-(\d{1,2}),\s*\d{4}/);
  if (compactRange) {
    return `${compactRange[1]} ${compactRange[3]}, ${year}`;
  }

  const splitRange = String(dates).match(/\b([A-Z][a-z]{2})\s+\d{1,2}\s*-\s*([A-Z][a-z]{2})?\s*(\d{1,2}),\s*\d{4}/);
  if (splitRange) {
    return `${splitRange[2] || splitRange[1]} ${splitRange[3]}, ${year}`;
  }

  return dates;
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
