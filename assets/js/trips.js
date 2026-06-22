import { animatePage, formatCurrency, initAuthChrome, initHeader, initTheme } from "./ui.js";
import { initCustomControls } from "./controls.js";
import { getCurrentUser, getState } from "./store.js";

const form = document.querySelector("[data-trip-filter-form]");
const list = document.querySelector("[data-trip-list]");
const emptyState = document.querySelector("[data-trip-empty]");
const countLabel = document.querySelector("[data-trip-results-count]");
const titleLabel = document.querySelector("[data-trip-results-title]");
const stats = document.querySelector("[data-trip-stats]");
const activeFilters = document.querySelector("[data-trip-active-filters]");

const trips = await loadTrips();
const defaultFilters = {
  query: "",
  type: "all",
  status: "all",
  destination: "all",
  sort: "date-asc"
};

initTheme();
initHeader();
initAuthChrome();
populateFilterOptions();
hydrateFromUrl();
initCustomControls();
renderStats();
renderTrips();
bindFilters();
animatePage();

async function loadTrips() {
  const response = await fetch("../assets/data/trips.json");
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function bindFilters() {
  form.addEventListener("input", (event) => {
    if (!event.target.matches("input, select")) return;
    renderTrips();
  });

  form.addEventListener("change", (event) => {
    if (!event.target.matches("input, select")) return;
    renderTrips();
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      syncEnhancedSelects();
      renderTrips();
    }, 0);
  });

  activeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear-trip-filter]");
    if (!button) return;
    const key = button.dataset.clearTripFilter;
    form.elements[key].value = defaultFilters[key];
    syncEnhancedSelects();
    renderTrips();
  });
}

function populateFilterOptions() {
  setOptions("[data-filter-trip-type]", unique(trips.map((trip) => trip.type)));
  setOptions("[data-filter-trip-status]", unique(trips.map((trip) => trip.status)), formatTripStatus);
  setOptions("[data-filter-trip-destination]", unique(trips.map((trip) => trip.destination)));
}

function setOptions(selector, values, formatLabel = (value) => value) {
  const select = document.querySelector(selector);
  select.innerHTML += values
    .sort((a, b) => a.localeCompare(b))
    .map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(formatLabel(value))}</option>`)
    .join("");
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  setFormValue("query", params.get("q") || defaultFilters.query);
  setFormValue("type", params.get("type") || defaultFilters.type);
  setFormValue("status", params.get("status") || defaultFilters.status);
  setFormValue("destination", params.get("destination") || defaultFilters.destination);
  setFormValue("sort", params.get("sort") || defaultFilters.sort);
}

function renderStats() {
  const confirmed = trips.filter((trip) => trip.status === "Confirmed").length;
  const destinations = unique(trips.map((trip) => trip.destination)).length;
  const totalBudget = trips.reduce((sum, trip) => sum + Number(trip.budget || 0), 0);
  const active = trips.filter((trip) => trip.status === "In progress").length;

  stats.innerHTML = `
    <article>
      <strong>${trips.length}</strong>
      <span>trip plans</span>
    </article>
    <article>
      <strong>${destinations}</strong>
      <span>destinations</span>
    </article>
    <article>
      <strong>${confirmed}</strong>
      <span>ready trips</span>
    </article>
    <article>
      <strong>${formatCurrency(totalBudget)}</strong>
      <span>planned budget</span>
    </article>
    <article>
      <strong>${active}</strong>
      <span>happening now</span>
    </article>
  `;
}

function renderTrips() {
  const filters = getFilters();
  const filteredTrips = sortTrips(trips.filter((trip) => matchesFilters(trip, filters)), filters.sort);
  renderActiveFilters(filters);
  updateUrl(filters);

  countLabel.textContent = `${filteredTrips.length} ${filteredTrips.length === 1 ? "trip" : "trips"}`;
  titleLabel.textContent = filters.query ? `Results for "${filters.query}"` : "All trips";
  emptyState.hidden = filteredTrips.length > 0;
  list.hidden = filteredTrips.length === 0;
  list.innerHTML = filteredTrips.map(renderTripCard).join("");
}

function renderTripCard(trip) {
  const status = trip.status.toLowerCase().replaceAll(" ", "-");
  const statusLabel = formatTripStatus(trip.status);

  const state = getState();
  const currentUser = getCurrentUser();
  const tripBookings = state.tripBookings || [];
  const isPending = currentUser && tripBookings.some((tb) => tb.tripId === trip.id && tb.userId === currentUser.id && tb.status === "pending");
  const pendingBadge = isPending ? `<span class="trip-status pending" style="background: var(--gold); color: #fff; border-color: rgba(255, 255, 255, 0.25);">Pending</span>` : "";

  return `
    <article class="trip-directory-card">
      <div class="trip-directory-image">
        <img src="${escapeAttr(trip.image)}" alt="${escapeAttr(trip.title)}" loading="lazy">
        <span>${escapeHtml(trip.type)}</span>
      </div>
      <div class="trip-directory-copy">
        <div class="trip-card-head">
          ${pendingBadge ? pendingBadge : `<span class="trip-status ${status}">${escapeHtml(statusLabel)}</span>`}
          <span class="trip-budget">${formatCurrency(trip.budget)}</span>
        </div>
        <h3>${escapeHtml(trip.title)}</h3>
        <p>${escapeHtml(trip.concierge)}</p>
        <div class="trip-facts">
          <span>${escapeHtml(trip.destination)}</span>
          <span>${escapeHtml(trip.dates)}</span>
          <span>${escapeHtml(trip.duration)}</span>
          <span>${Number(trip.stays)} stay${Number(trip.stays) === 1 ? "" : "s"}</span>
        </div>
        <div class="trip-directory-footer">
          <div>
            <strong>${escapeHtml(trip.guest)}</strong>
            <small>Managed by ${escapeHtml(trip.manager)}</small>
          </div>
          <a class="secondary-button compact trip-details-button" href="trip-details.html?id=${encodeURIComponent(trip.id)}">Details</a>
        </div>
      </div>
    </article>
  `;
}

function getFilters() {
  return {
    query: form.elements.query.value.trim(),
    type: form.elements.type.value,
    status: form.elements.status.value,
    destination: form.elements.destination.value,
    sort: form.elements.sort.value
  };
}

function matchesFilters(trip, filters) {
  const query = filters.query.toLowerCase();
  const haystack = [trip.title, trip.type, trip.guest, trip.destination, trip.status, trip.concierge, trip.manager].join(" ").toLowerCase();
  const matchesQuery = !query || query.split(/\s+/).every((term) => haystack.includes(term));
  const matchesType = filters.type === "all" || trip.type === filters.type;
  const matchesStatus = filters.status === "all" || trip.status === filters.status;
  const matchesDestination = filters.destination === "all" || trip.destination === filters.destination;
  return matchesQuery && matchesType && matchesStatus && matchesDestination;
}

function sortTrips(items, sort) {
  return [...items].sort((a, b) => {
    if (sort === "budget-desc") return Number(b.budget || 0) - Number(a.budget || 0);
    if (sort === "duration-desc") return parseDuration(b.duration) - parseDuration(a.duration);
    if (sort === "title-asc") return a.title.localeCompare(b.title);
    return parseTripStart(a.dates) - parseTripStart(b.dates);
  });
}

function renderActiveFilters(filters) {
  const chips = [];
  if (filters.query) chips.push(["query", `Search: ${filters.query}`]);
  if (filters.type !== "all") chips.push(["type", filters.type]);
  if (filters.status !== "all") chips.push(["status", formatTripStatus(filters.status)]);
  if (filters.destination !== "all") chips.push(["destination", filters.destination]);

  activeFilters.innerHTML = chips.length
    ? chips.map(([key, label]) => `<button class="filter-chip" type="button" data-clear-trip-filter="${key}">${escapeHtml(label)} <span aria-hidden="true">×</span></button>`).join("")
    : `<span class="filter-hint">Showing the full trip directory</span>`;
}

function updateUrl(filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.type !== defaultFilters.type) params.set("type", filters.type);
  if (filters.status !== defaultFilters.status) params.set("status", filters.status);
  if (filters.destination !== defaultFilters.destination) params.set("destination", filters.destination);
  if (filters.sort !== defaultFilters.sort) params.set("sort", filters.sort);
  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function setFormValue(name, value) {
  const control = form.elements[name];
  if (!control) return;
  const optionValues = control.tagName === "SELECT" ? [...control.options].map((option) => option.value) : null;
  control.value = optionValues && !optionValues.includes(value) ? defaultFilters[name] : value;
}

function syncEnhancedSelects() {
  form.querySelectorAll("select").forEach((select) => {
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function parseDuration(duration) {
  return Number(String(duration).match(/\d+/)?.[0] || 0);
}

function parseTripStart(dates) {
  const [rawDate] = String(dates).split("-");
  return new Date(`${rawDate.trim()}, ${String(dates).match(/\d{4}/)?.[0] || "2026"}`).getTime() || 0;
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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
