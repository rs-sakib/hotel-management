import { clearCurrentUser, createId, findHotel, findUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { animatePage, formatCurrency, initAuthChrome, initTheme, renderAdminSummary, showToast, statusPill, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

const filters = {
  transactions: { search: "", type: "all", method: "all", status: "all" }
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
  initAdminForms();
  initFilters();
  initConfirmModal();
  renderAdminProfile();
  renderTransactionsPage();
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

function initAdminForms() {
  const executeTransactionAction = (txId, txItemType, txAction) => {
    if (txAction === "delete") {
      showConfirm("Delete this request record?", () => {
        updateState((state) => {
          if (txItemType === "booking") {
            state.bookings = state.bookings.filter((item) => item.id !== txId);
          } else if (txItemType === "tripBooking") {
            state.tripBookings = (state.tripBookings || []).filter((item) => item.id !== txId);
          }
        });
        renderTransactionsPage();
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
      renderTransactionsPage();
      showToast("Booking request approved.");
      return;
    }

    if (txAction === "view") {
      const state = getState();
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
          status: getTransactionStatus(booking.payment, booking.status),
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
          status: getTransactionStatus(request.payment, request.status),
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
        <div><strong>Guest Name:</strong> ${escapeHtml(tx.guestName)}</div>
        <div><strong>Guest Email:</strong> ${escapeHtml(tx.guestEmail)}</div>
        <div><strong>Guest Phone:</strong> ${escapeHtml(tx.guestPhone)}</div>
        <div><strong>Payment Method:</strong> <span class="status-pill">${escapeHtml(tx.method)}</span></div>
        <div><strong>Transaction ID:</strong> <code style="font-family: monospace; font-size: 0.95rem; font-weight: bold; color: var(--gold);">${escapeHtml(tx.transactionId || "N/A")}</code></div>
        <div><strong>Amount:</strong> <strong>${formatCurrency(tx.amount)}</strong></div>
        <div><strong>Payment Status:</strong> ${escapeHtml(tx.status.toUpperCase())}</div>
      `;

      content.innerHTML = detailsHtml;
      overlay.classList.add("open");
    }
  };

  document.querySelector("[data-transactions-table]")?.addEventListener("click", (event) => {
    const dotsBtn = event.target.closest(".three-dots-btn");
    if (dotsBtn) {
      event.stopPropagation();
      const dropdown = document.getElementById("globalTxDropdown");
      if (!dropdown) return;

      const txId = dotsBtn.dataset.txId;
      const txItemType = dotsBtn.dataset.txItemType;
      const bookingStatus = dotsBtn.dataset.bookingStatus;

      const isSame = dropdown.style.display === "flex" && dropdown.dataset.activeTxId === txId;
      if (isSame) {
        dropdown.style.display = "none";
        dropdown.removeAttribute("data-active-tx-id");
        return;
      }

      dropdown.dataset.activeTxId = txId;
      dropdown.querySelectorAll("[data-tx-action]").forEach((btn) => {
        btn.dataset.txId = txId;
        btn.dataset.txItemType = txItemType;
        if (btn.dataset.txAction === "approve") {
          if (bookingStatus === "approved") {
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

  const globalTxDropdown = document.getElementById("globalTxDropdown");
  globalTxDropdown?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-tx-action]");
    if (!actionButton) return;
    if (actionButton.hasAttribute("disabled") || actionButton.disabled) return;
    event.stopPropagation();

    globalTxDropdown.style.display = "none";
    globalTxDropdown.removeAttribute("data-active-tx-id");

    const { txId, txItemType, txAction } = actionButton.dataset;
    executeTransactionAction(txId, txItemType, txAction);
  });

  document.addEventListener("click", (event) => {
    document.querySelectorAll(".actions-dropdown-menu:not(#globalTxDropdown)").forEach((m) => m.setAttribute("hidden", ""));

    const globalTxDropdown = document.getElementById("globalTxDropdown");
    if (globalTxDropdown && !event.target.closest(".three-dots-btn") && !event.target.closest("#globalTxDropdown")) {
      globalTxDropdown.style.display = "none";
      globalTxDropdown.removeAttribute("data-active-tx-id");
    }
  });

  window.addEventListener("scroll", () => {
    const globalTxDropdown = document.getElementById("globalTxDropdown");
    if (globalTxDropdown && globalTxDropdown.style.display === "flex") {
      globalTxDropdown.style.display = "none";
      globalTxDropdown.removeAttribute("data-active-tx-id");
    }
  }, true);

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
        const existing = state.paymentMethods.find((m) => m.id === methodId);
        if (existing) {
          existing.name = name;
          existing.number = number;
          existing.logo = logo || "https://images.unsplash.com/photo-1579621970795-87faff3f2160?auto=format&fit=crop&w=80&q=80";
        }
      } else {
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
    renderTransactionsPage();
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
        renderTransactionsPage();
        showToast("Payment method deleted.");
      });
      return;
    }
  });
}

function initFilters() {
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

function renderTransactionsPage() {
  const state = getState();
  renderTransactions(state);
  renderPaymentMethods(state);
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
      status: getTransactionStatus(booking.payment, booking.status),
      bookingStatus: booking.status || "pending"
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
      status: getTransactionStatus(request.payment, request.status),
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

  if (summaryContainer) {
    const totalAmount = filtered.reduce((sum, tx) => sum + (tx.status === "paid" ? tx.amount : 0), 0);
    const pendingCount = filtered.filter((tx) => tx.status !== "paid").length;
    setSummary("[data-transaction-summary]", [
      { label: "Filtered transactions", value: filtered.length, icon: "transaction", tone: "total" },
      { label: "Pending verification", value: pendingCount, icon: "pending", tone: "pending" },
      { label: "Total paid", value: formatCurrency(totalAmount), icon: "paid", tone: "paid" },
      { label: "Unpaid bookings", value: filtered.filter((tx) => tx.status !== "paid").length, icon: "booking", tone: "approved" }
    ]);
  }

  table.innerHTML = filtered.length
    ? filtered
      .map((tx) => {
        const typeClass = tx.type === "Hotel Stay" ? "status-pill planning" : "status-pill in-progress";
        return `
            <tr>
              <td data-label="Type"><span class="${typeClass}">${tx.type}</span></td>
              <td data-label="Guest" class="guest-info-cell"><strong>${escapeHtml(tx.guestName)}</strong><br><small>${escapeHtml(tx.guestEmail)}</small></td>
              <td data-label="Reference" class="transaction-reference"><strong>${escapeHtml(tx.reference)}</strong></td>
              <td data-label="Method"><span class="status-pill">${escapeHtml(tx.method)}</span></td>
              <td data-label="Transaction ID" class="transaction-id-cell"><code style="font-family: monospace; font-size: 0.88rem; font-weight: bold; color: var(--gold);">${escapeHtml(tx.transactionId || "N/A")}</code></td>
              <td data-label="Amount"><strong>${formatCurrency(tx.amount)}</strong></td>
              <td data-label="Status">${statusPill(tx.status)}</td>
              <td data-label="Actions">
                <div class="actions-dropdown-container">
                  <button class="three-dots-btn" type="button" aria-label="Actions" 
                          data-tx-id="${tx.id}" 
                          data-tx-item-type="${tx.itemType}" 
                          data-booking-status="${tx.bookingStatus}">⋮</button>
                </div>
              </td>
            </tr>
          `;
      })
      .join("")
    : `<tr>
        <td colspan="8">
          <div class="table-empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <strong>No transactions found</strong>
            <p>We couldn't find any financial transactions matching your search filters.</p>
          </div>
        </td>
      </tr>`;
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
    : `
      <div class="grid-empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2"></rect>
            <line x1="2" x2="22" y1="10" y2="10"></line>
          </svg>
        </div>
        <strong>No payment methods</strong>
        <p>No payment methods configured. Use the form above to add a payment method.</p>
      </div>
    `;

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
  if ([...select.options].some((opt) => opt.value === currentSelection)) {
    select.value = currentSelection;
  } else {
    select.value = "all";
    filters.transactions.method = "all";
  }
}

function setSummary(selector, items) {
  const root = document.querySelector(selector);
  if (!root) return;
  renderAdminSummary(root, items);
}

function getTransactionStatus(paymentStatus, bookingStatus) {
  if (bookingStatus !== "approved") return "pending";
  return paymentStatus === "paid" ? "paid" : "unpaid";
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
