import { createId, findHotel, getCurrentUser, getState, setCurrentUser, updateState } from "./store.js";
import { loadHotelCatalog } from "./hotel-catalog.js";
import { animatePage, formatCurrency, initAuthChrome, initHeader, initTheme, showToast } from "./ui.js";
import { initCustomControls } from "./controls.js";

const params = new URLSearchParams(window.location.search);
const hotelId = params.get("id");
const state = getState();
const catalogHotels = await loadHotelCatalog(state.hotels || []);
const hotel = findHotel(state, hotelId) || catalogHotels.find((item) => item.id === hotelId);
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
  const hasPendingRequest = currentUser && state.bookings.some(
    (b) => b.hotelId === hotel.id && b.userId === currentUser.id && b.status === "pending"
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
        You already have a pending reservation request for this hotel. You cannot submit another request until the administrator reviews your pending application.
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

  // Set deposit amount (1 night rate)
  if (depositAmountVal && hotel && hotel.price) {
    depositAmountVal.textContent = formatCurrency(hotel.price);
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
      showToast("Demo guest session started. Your request will appear in the guest dashboard.");
    }

    const formData = new FormData(bookingForm);
    const paymentChoice = formData.get("payment");

    updateState((draft) => {
      if (!draft.hotels.some((item) => item.id === hotel.id)) {
        draft.hotels.push(hotel);
      }
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
        payment: paymentChoice,
        paymentMethod: paymentChoice === "paid" ? formData.get("paymentMethod") : "N/A",
        transactionId: paymentChoice === "paid" ? (formData.get("transactionId") || "").trim() : "",
        createdAt: new Date().toISOString()
      });
    });

    bookingForm.reset();
    bookingForm.hotelId.value = hotel.id;
    updatePaymentUI();
    updateMerchantNumber();
    showToast("Booking request sent to admin for approval.");
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1500);
  });
}

function renderMissingHotel() {
  detailRoot.innerHTML = `
    <section class="access-warning">
      <p class="eyebrow">Hotel unavailable</p>
      <h2>We could not find that hotel.</h2>
      <p class="muted">The property may have been removed or the link is missing a hotel id.</p>
      <a class="primary-button" href="hotels.html">Browse hotels</a>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
