import { getState } from "./store.js";
import { loadHotelCatalog } from "./hotel-catalog.js";
import { animatePage, formatCurrency, initAuthChrome, initHeader, initTheme } from "./ui.js";
import { initCustomControls } from "./controls.js";

const state = getState();
const hotels = await loadHotelCatalog(state.hotels || []);
const form = document.querySelector("[data-hotel-filter-form]");
const list = document.querySelector("[data-hotels-list]");
const emptyState = document.querySelector("[data-hotel-empty]");
const countLabel = document.querySelector("[data-results-count]");
const titleLabel = document.querySelector("[data-results-title]");
const stats = document.querySelector("[data-hotels-stats]");
const priceInput = document.querySelector("[data-filter-price]");
const priceLabel = document.querySelector("[data-price-label]");
const activeFilters = document.querySelector("[data-active-filters]");

const defaultFilters = {
  query: "",
  city: "all",
  amenity: "all",
  rating: "all",
  rooms: "all",
  sort: "recommended",
  maxPrice: getHighestPrice()
};

initTheme();
initHeader();
initAuthChrome();
populateFilterOptions();
hydrateFromUrl();
initCustomControls();
renderStats();
renderHotels();
bindFilters();
animatePage();

function bindFilters() {
  form.addEventListener("input", (event) => {
    if (!event.target.matches("input, select")) return;
    renderHotels();
  });

  form.addEventListener("change", (event) => {
    if (!event.target.matches("input, select")) return;
    renderHotels();
  });

  form.addEventListener("reset", () => {
    setTimeout(() => {
      priceInput.value = String(defaultFilters.maxPrice);
      syncPriceLabel();
      renderHotels();
    }, 0);
  });

  activeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear-filter]");
    if (!button) return;
    const key = button.dataset.clearFilter;
    if (key === "query") form.elements.query.value = "";
    if (key === "city") form.elements.city.value = "all";
    if (key === "amenity") form.elements.amenity.value = "all";
    if (key === "rating") form.elements.rating.value = "all";
    if (key === "rooms") form.elements.rooms.value = "all";
    if (key === "maxPrice") form.elements.maxPrice.value = String(defaultFilters.maxPrice);
    syncEnhancedSelects();
    renderHotels();
  });
}

function populateFilterOptions() {
  const cities = unique(hotels.map((hotel) => hotel.city)).sort();
  const amenities = unique(hotels.flatMap((hotel) => hotel.amenities || [])).sort();

  document.querySelector("[data-filter-city]").innerHTML += cities
    .map((city) => `<option value="${escapeAttr(city)}">${escapeHtml(city)}</option>`)
    .join("");

  document.querySelector("[data-filter-amenity]").innerHTML += amenities
    .map((amenity) => `<option value="${escapeAttr(amenity)}">${escapeHtml(amenity)}</option>`)
    .join("");

  const highest = getHighestPrice();
  priceInput.max = String(Math.ceil(highest / 5) * 5);
  priceInput.value = String(defaultFilters.maxPrice);
  syncPriceLabel();
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  form.elements.query.value = params.get("q") || defaultFilters.query;
  setFormValue("city", params.get("city") || defaultFilters.city);
  setFormValue("amenity", params.get("amenity") || defaultFilters.amenity);
  setFormValue("rating", params.get("rating") || defaultFilters.rating);
  setFormValue("rooms", params.get("rooms") || defaultFilters.rooms);
  setFormValue("sort", params.get("sort") || defaultFilters.sort);

  const urlPrice = Number(params.get("maxPrice"));
  form.elements.maxPrice.value = Number.isFinite(urlPrice) && urlPrice > 0 ? String(Math.min(urlPrice, Number(priceInput.max))) : String(defaultFilters.maxPrice);
  syncPriceLabel();
}

function renderStats() {
  const averageRating = hotels.length ? hotels.reduce((sum, hotel) => sum + Number(hotel.rating || 0), 0) / hotels.length : 0;
  const totalRooms = hotels.reduce((sum, hotel) => sum + Number(hotel.rooms || 0), 0);
  const locations = unique(hotels.map((hotel) => hotel.city)).length;

  stats.innerHTML = `
    <article>
      <strong>${hotels.length}</strong>
      <span>hotels listed</span>
    </article>
    <article>
      <strong>${locations}</strong>
      <span>locations</span>
    </article>
    <article>
      <strong>${totalRooms}</strong>
      <span>rooms open</span>
    </article>
    <article>
      <strong>${averageRating.toFixed(1)}</strong>
      <span>avg rating</span>
    </article>
  `;
}

function renderHotels() {
  const filters = getFilters();
  const filteredHotels = sortHotels(hotels.filter((hotel) => matchesFilters(hotel, filters)), filters.sort);
  syncPriceLabel(filters.maxPrice);
  renderActiveFilters(filters);
  updateUrl(filters);

  countLabel.textContent = `${filteredHotels.length} ${filteredHotels.length === 1 ? "hotel" : "hotels"}`;
  titleLabel.textContent = filters.query ? `Results for "${filters.query}"` : "All hotels";
  emptyState.hidden = filteredHotels.length > 0;
  list.hidden = filteredHotels.length === 0;

  list.innerHTML = filteredHotels.map(renderHotelCard).join("");
}

function renderHotelCard(hotel) {
  const detailsUrl = `hotel-details.html?id=${encodeURIComponent(hotel.id)}`;
  const badge = hotel.rating >= 4.9
    ? { text: "Recommended", class: "recommended" }
    : { text: "Top", class: "top-choice" };
  return `
    <article class="hotel-card hotel-directory-card">
      <a class="hotel-image" href="${detailsUrl}" aria-label="View ${escapeAttr(hotel.name)} details">
        <img src="${escapeAttr(hotel.image)}" alt="${escapeAttr(hotel.name)}" loading="lazy">
        <div class="hotel-badges-container">
          <span class="glass-tag ${badge.class}">${badge.text}</span>
          <span class="glass-tag glass-rating-badge">
            <svg class="star-icon" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            <span>${Number(hotel.rating).toFixed(1)}</span>
          </span>
        </div>
      </a>
      <div class="hotel-content">
        <div class="hotel-card-title-row">
          <div>
            <h3>${escapeHtml(hotel.name)}</h3>
            <p class="hotel-location">${escapeHtml(hotel.city)}</p>
          </div>
        </div>
        <p class="muted">${escapeHtml(hotel.description)}</p>
        <div class="hotel-meta">
          <span>${Number(hotel.rooms)} rooms open</span>
          <span>${formatCurrency(hotel.price)} nightly</span>
        </div>
        <ul class="amenity-list">
          ${(hotel.amenities || []).map((amenity) => `<li>${escapeHtml(amenity)}</li>`).join("")}
        </ul>
        <div class="hotel-bottom">
          <span class="price">${formatCurrency(hotel.price)} <small>/ night</small></span>
          <div class="hotel-card-actions">
            <a class="primary-button compact" href="${detailsUrl}">Details</a>
          </div>
        </div>
      </div>
    </article>
  `;
}

function getFilters() {
  return {
    query: form.elements.query.value.trim(),
    city: form.elements.city.value,
    amenity: form.elements.amenity.value,
    rating: form.elements.rating.value,
    rooms: form.elements.rooms.value,
    sort: form.elements.sort.value,
    maxPrice: Number(form.elements.maxPrice.value)
  };
}

function matchesFilters(hotel, filters) {
  const haystack = [hotel.name, hotel.city, hotel.description, ...(hotel.amenities || [])].join(" ").toLowerCase();
  const query = filters.query.toLowerCase();
  const matchesQuery = !query || query.split(/\s+/).every((term) => haystack.includes(term));
  const matchesCity = filters.city === "all" || hotel.city === filters.city;
  const matchesAmenity = filters.amenity === "all" || (hotel.amenities || []).includes(filters.amenity);
  const matchesRating = filters.rating === "all" || Number(hotel.rating) >= Number(filters.rating);
  const matchesRooms = filters.rooms === "all" || Number(hotel.rooms) >= Number(filters.rooms);
  const matchesPrice = Number(hotel.price) <= filters.maxPrice;

  return matchesQuery && matchesCity && matchesAmenity && matchesRating && matchesRooms && matchesPrice;
}

function sortHotels(items, sort) {
  return [...items].sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "rating-desc") return b.rating - a.rating || a.price - b.price;
    if (sort === "rooms-desc") return b.rooms - a.rooms;
    if (sort === "name-asc") return a.name.localeCompare(b.name);
    return b.rating - a.rating || b.rooms - a.rooms || a.price - b.price;
  });
}

function renderActiveFilters(filters) {
  const chips = [];
  if (filters.query) chips.push(["query", `Search: ${filters.query}`]);
  if (filters.city !== "all") chips.push(["city", filters.city]);
  if (filters.amenity !== "all") chips.push(["amenity", filters.amenity]);
  if (filters.rating !== "all") chips.push(["rating", `${filters.rating}+ rating`]);
  if (filters.rooms !== "all") chips.push(["rooms", `${filters.rooms}+ rooms`]);
  if (filters.maxPrice < defaultFilters.maxPrice) chips.push(["maxPrice", `Up to ${formatCurrency(filters.maxPrice)}`]);

  activeFilters.innerHTML = chips.length
    ? chips.map(([key, label]) => `<button class="filter-chip" type="button" data-clear-filter="${key}">${escapeHtml(label)} <span aria-hidden="true">×</span></button>`).join("")
    : `<span class="filter-hint">Showing the full hotel directory</span>`;
}

function updateUrl(filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.city !== defaultFilters.city) params.set("city", filters.city);
  if (filters.amenity !== defaultFilters.amenity) params.set("amenity", filters.amenity);
  if (filters.rating !== defaultFilters.rating) params.set("rating", filters.rating);
  if (filters.rooms !== defaultFilters.rooms) params.set("rooms", filters.rooms);
  if (filters.sort !== defaultFilters.sort) params.set("sort", filters.sort);
  if (filters.maxPrice < defaultFilters.maxPrice) params.set("maxPrice", String(filters.maxPrice));

  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function setFormValue(name, value) {
  const control = form.elements[name];
  if (!control) return;
  const optionValues = control.tagName === "SELECT" ? [...control.options].map((option) => option.value) : null;
  control.value = optionValues && !optionValues.includes(value) ? defaultFilters[name] : value;
}

function syncPriceLabel(value = Number(priceInput.value)) {
  priceLabel.textContent = formatCurrency(value);
}

function syncEnhancedSelects() {
  form.querySelectorAll("select").forEach((select) => {
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function getHighestPrice() {
  return hotels.length ? Math.max(...hotels.map((hotel) => Number(hotel.price || 0))) : 0;
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
