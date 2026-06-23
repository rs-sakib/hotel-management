import { clearCurrentUser, getCurrentUser, getState, isAdminUser, updateState } from "./store.js";
import { loadHotelCatalog } from "./hotel-catalog.js";
import { adminStatIcon, animateCounters, animatePage, counterValueMarkup, formatCurrency, initAuthChrome, initTheme, userAvatarMarkup } from "./ui.js";
import { initCustomControls } from "./controls.js";

const accessWarning = document.querySelector("[data-access-warning]");
const adminContent = document.querySelector("[data-admin-content]");
const currentUser = getCurrentUser();

initTheme();
initAuthChrome();
initCustomControls();
animatePage();

if (!isAdminUser(currentUser)) {
  accessWarning.hidden = false;
  adminContent.hidden = true;
} else {
  await hydrateHotelCatalog();
  initChartTooltips();
  renderAdminProfile();
  renderOverview();
}

document.querySelector("[data-logout]").addEventListener("click", () => {
  clearCurrentUser();
  window.location.href = "admin-login.html";
});

async function hydrateHotelCatalog() {
  const state = getState();
  const mergedHotels = await loadHotelCatalog(state.hotels || []);
  const currentIds = state.hotels.map((hotel) => hotel.id).join("|");
  const mergedIds = mergedHotels.map((hotel) => hotel.id).join("|");
  if (currentIds === mergedIds) return;

  updateState((draft) => {
    draft.hotels = mergedHotels;
  });
}

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

function renderOverview() {
  const state = getState();
  renderMetrics(state);
  renderOverviewCharts(state);
  renderOverviewLists(state);
}

function renderMetrics(state) {
  const analysis = analyzeState(state);
  const root = document.querySelector("[data-admin-metrics]");
  if (!root) return;
  root.innerHTML = [
    ["Portfolio", state.hotels.length, `${analysis.cityCount} active locations`, "total", adminStatIcon("hotel")],
    ["Bookings", state.bookings.length, `${analysis.pending} pending review`, "pending", adminStatIcon("booking")],
    ["Paid revenue", formatCurrency(analysis.paidRevenue), `${analysis.paidBookings} paid bookings`, "paid", adminStatIcon("rate")],
    ["Open rooms", analysis.totalRooms, `${analysis.averageRating.toFixed(1)} average rating`, "approved", adminStatIcon("room")]
  ]
    .map(
      ([label, value, detail, type, icon]) => `
        <article class="metric-card ${type}">
          <div class="metric-info">
            <span>${escapeHtml(label)}</span>
            <strong>${counterValueMarkup(value)}</strong>
            <small>${escapeHtml(detail)}</small>
          </div>
          <div class="metric-icon">${icon}</div>
        </article>
      `
    )
    .join("");
  animateCounters(root);
}

function renderOverviewCharts(state) {
  const analysis = analyzeState(state);
  document.querySelector("[data-admin-revenue-total]").textContent = formatCurrency(analysis.paidRevenue);
  document.querySelector("[data-admin-booking-total]").textContent = `${state.bookings.length} total`;
  document.querySelector("[data-city-total]").textContent = `${analysis.cityCount} cities`;
  document.querySelector("[data-room-total]").textContent = `${analysis.totalRooms} rooms`;

  renderRevenueChart(state);
  renderTrendsChart(state);
  renderStatusChart(analysis);
  renderCityChart(state);
  renderRoomChart(state);
}

function renderRevenueChart(state) {
  const chartContainer = document.querySelector("[data-admin-chart]");
  if (!chartContainer) return;
  const revenueByHotel = state.hotels
    .map((hotel) => ({
      label: shortenHotelName(hotel.name),
      value: state.bookings.reduce((sum, booking) => {
        if (booking.hotelId !== hotel.id || booking.payment !== "paid") return sum;
        return sum + Number(hotel.price || 0) * getBookingNights(booking);
      }, 0)
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const fallback = state.hotels
    .slice()
    .sort((a, b) => b.rooms - a.rooms)
    .slice(0, 8)
    .map((hotel) => ({ label: shortenHotelName(hotel.name), value: Number(hotel.rooms || 0), suffix: " rooms" }));

  const data = revenueByHotel.length ? revenueByHotel : fallback;
  if (!data.length) {
    chartContainer.innerHTML = `<div class="empty-state">No revenue data available.</div>`;
    return;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 100);
  const width = 700;
  const height = 220;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 25;
  const paddingBottom = 40;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const points = data.map((item, index) => {
    const x = paddingLeft + (index * (plotWidth / Math.max(1, data.length - 1)));
    const y = paddingTop + plotHeight - (item.value / maxValue) * plotHeight;
    return { x, y, label: item.label, value: item.value, suffix: item.suffix };
  });

  let gridHtml = "";
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = paddingTop + plotHeight - (plotHeight * (i / gridSteps));
    const val = Math.round((maxValue * (i / gridSteps)));
    const displayVal = data[0].suffix ? `${val}${data[0].suffix}` : `$${val}`;
    gridHtml += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4,4" />
      <text x="${paddingLeft - 10}" y="${y + 4}" fill="var(--muted)" font-size="10" font-weight="800" text-anchor="end">${displayVal}</text>
    `;
  }

  let linePathD = "";
  let areaPathD = "";
  if (points.length > 0) {
    linePathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    areaPathD = `M ${points[0].x} ${paddingTop + plotHeight} L ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${points[points.length - 1].x} ${paddingTop + plotHeight} Z`;
  }

  const interactiveElements = points.map((p, index) => {
    const displayVal = p.suffix ? `${p.value}${p.suffix}` : formatCurrency(p.value);
    return `
      <g class="chart-point-group">
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--primary)" stroke="var(--surface)" stroke-width="2" class="chart-point" />
        <circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent" pointer-events="all" class="chart-hitbox" style="cursor:pointer;" data-tooltip-title="${p.label}" data-tooltip-value="${displayVal}" />
        <text x="${p.x}" y="${p.y - 12}" fill="var(--primary-dark)" font-size="10" font-weight="900" text-anchor="middle" class="chart-point-label">${displayVal}</text>
        <text x="${p.x}" y="${height - 15}" fill="var(--muted)" font-size="9" font-weight="800" text-anchor="middle" class="chart-x-label">${p.label}</text>
      </g>
    `;
  }).join("");

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible;">
      <defs>
        <linearGradient id="line-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.32" />
          <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      ${gridHtml}
      ${areaPathD ? `<path d="${areaPathD}" fill="url(#line-area-grad)" />` : ""}
      ${linePathD ? `<path d="${linePathD}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : ""}
      ${interactiveElements}
    </svg>
  `;

  if (window.gsap) {
    const linePath = chartContainer.querySelector("path[stroke='var(--primary)']");
    const areaPath = chartContainer.querySelector("path[fill^='url(#line-area-grad)']");
    const pts = chartContainer.querySelectorAll(".chart-point");
    const ptLabels = chartContainer.querySelectorAll(".chart-point-label");
    const xLabels = chartContainer.querySelectorAll(".chart-x-label");

    const tl = window.gsap.timeline();
    if (linePath) {
      const pathLength = linePath.getTotalLength();
      tl.fromTo(linePath,
        { strokeDasharray: pathLength, strokeDashoffset: pathLength },
        { strokeDashoffset: 0, duration: 1.0, ease: "power2.out" }
      );
    }
    if (areaPath) {
      tl.from(areaPath, { opacity: 0, duration: 0.8, ease: "power2.out" }, "-=0.6");
    }
    if (pts.length) {
      tl.from(pts, { scale: 0, transformOrigin: "center", duration: 0.4, stagger: 0.05, ease: "back.out(1.7)" }, "-=0.4");
    }
    if (ptLabels.length) {
      tl.from(ptLabels, { opacity: 0, y: "+=8", duration: 0.4, stagger: 0.05, ease: "power2.out" }, "-=0.3");
    }
    if (xLabels.length) {
      tl.from(xLabels, { opacity: 0, y: "+=6", duration: 0.4, stagger: 0.04, ease: "power2.out" }, "-=0.4");
    }
  }
}

function renderTrendsChart(state) {
  const chartContainer = document.querySelector("[data-trends-chart]");
  if (!chartContainer) return;

  const hotelsData = state.hotels.slice(0, 6).map(hotel => {
    const revenue = state.bookings.reduce((sum, booking) => {
      if (booking.hotelId !== hotel.id || booking.payment !== "paid") return sum;
      return sum + Number(hotel.price || 0) * getBookingNights(booking);
    }, 0);
    return {
      label: shortenHotelName(hotel.name),
      value: revenue
    };
  });

  if (!hotelsData.length) {
    chartContainer.innerHTML = `<div class="empty-state">No hotel data available.</div>`;
    return;
  }

  const maxValue = Math.max(...hotelsData.map(item => item.value), 100);
  const width = 800;
  const height = 220;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 25;
  const paddingBottom = 40;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const yBottom = paddingTop + plotHeight;

  let gridHtml = "";
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = paddingTop + plotHeight - (plotHeight * (i / gridSteps));
    const val = Math.round(maxValue * (i / gridSteps));
    gridHtml += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4,4" />
      <text x="${paddingLeft - 12}" y="${y + 4}" fill="var(--muted)" font-size="10" font-weight="800" text-anchor="end">$${val}</text>
    `;
  }

  const n = hotelsData.length;
  const colWidth = plotWidth / n;
  const barWidth = 46;
  const r = 6;

  const barElements = hotelsData.map((item, index) => {
    const colCenter = paddingLeft + (index * colWidth) + (colWidth / 2);
    const barX = colCenter - (barWidth / 2);
    const y = paddingTop + plotHeight - (item.value / maxValue) * plotHeight;
    const barHeight = yBottom - y;

    let barPath = "";
    if (item.value > 0) {
      const radius = Math.min(r, barHeight);
      barPath = `
        <path d="M ${barX} ${yBottom} L ${barX} ${y + radius} Q ${barX} ${y} ${barX + radius} ${y} L ${barX + barWidth - radius} ${y} Q ${barX + barWidth} ${y} ${barX + barWidth} ${y + radius} L ${barX + barWidth} ${yBottom} Z" 
              fill="url(#bar-grad)" 
              class="chart-bar" />
      `;
    }

    const displayVal = formatCurrency(item.value);
    const textY = item.value > 0 ? y - 10 : yBottom - 10;
    const textColor = item.value > 0 ? "var(--primary)" : "var(--muted)";
    const fontWeight = item.value > 0 ? "900" : "700";

    return `
      <g class="chart-bar-group">
        ${barPath}
        <rect x="${barX}" y="${Math.min(y, yBottom - 30)}" width="${barWidth}" height="${Math.max(barHeight, 30)}" fill="transparent" pointer-events="all" style="cursor:pointer;" data-tooltip-title="${item.label}" data-tooltip-value="${displayVal}" />
        <text x="${colCenter}" y="${textY}" fill="${textColor}" font-size="10" font-weight="${fontWeight}" text-anchor="middle" class="chart-bar-label">${displayVal}</text>
        <text x="${colCenter}" y="${height - 15}" fill="var(--muted)" font-size="9" font-weight="800" text-anchor="middle" class="chart-x-label">${item.label}</text>
      </g>
    `;
  }).join("");

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible;">
      <defs>
        <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.85" />
          <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.1" />
        </linearGradient>
      </defs>
      ${gridHtml}
      ${barElements}
    </svg>
  `;

  if (window.gsap) {
    const bars = chartContainer.querySelectorAll(".chart-bar");
    const barLabels = chartContainer.querySelectorAll(".chart-bar-label");
    const xLabels = chartContainer.querySelectorAll(".chart-x-label");

    const tl = window.gsap.timeline();
    if (bars.length) {
      tl.from(bars, { scaleY: 0, transformOrigin: "bottom center", duration: 0.8, stagger: 0.08, ease: "power2.out" });
    }
    if (barLabels.length) {
      tl.from(barLabels, { opacity: 0, y: "+=12", duration: 0.5, stagger: 0.08, ease: "power2.out" }, "-=0.6");
    }
    if (xLabels.length) {
      tl.from(xLabels, { opacity: 0, y: "+=8", duration: 0.5, stagger: 0.06, ease: "power2.out" }, "-=0.5");
    }
  }
}

function renderStatusChart(analysis) {
  const chart = document.querySelector("[data-status-chart]");
  if (!chart) return;
  const total = Math.max(analysis.bookingTotal, 1);
  const approvedEnd = (analysis.approved / total) * 100;
  const pendingEnd = approvedEnd + (analysis.pending / total) * 100;
  const paidPercent = analysis.bookingTotal ? Math.round((analysis.paidBookings / analysis.bookingTotal) * 100) : 0;

  chart.innerHTML = `
    <div class="donut-chart" style="background: conic-gradient(var(--success) 0 ${approvedEnd}%, var(--gold) ${approvedEnd}% ${pendingEnd}%, var(--danger) ${pendingEnd}% 100%);">
      <div>
        <strong>${paidPercent}%</strong>
        <span>paid</span>
      </div>
    </div>
    <div class="chart-legend">
      ${legendItem("Approved", analysis.approved, "success")}
      ${legendItem("Pending", analysis.pending, "pending")}
      ${legendItem("Rejected", analysis.rejected, "danger")}
      ${legendItem("Unpaid", analysis.unpaidBookings, "muted")}
    </div>
  `;

  if (window.gsap) {
    window.gsap.from(chart.querySelector(".donut-chart"), { scale: 0, opacity: 0, rotation: -90, duration: 0.8, ease: "power2.out" });
    window.gsap.from(chart.querySelectorAll(".legend-item"), { opacity: 0, x: 12, duration: 0.4, stagger: 0.06, ease: "power2.out", delay: 0.2 });
  }
}

function renderCityChart(state) {
  const cities = groupCount(state.hotels, (hotel) => hotel.city)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  renderRankedList("[data-city-chart]", cities, state.hotels.length, "properties");
}

function renderRoomChart(state) {
  const segments = [
    { label: "60+ rooms", value: state.hotels.filter((hotel) => hotel.rooms >= 60).length },
    { label: "40-59 rooms", value: state.hotels.filter((hotel) => hotel.rooms >= 40 && hotel.rooms < 60).length },
    { label: "25-39 rooms", value: state.hotels.filter((hotel) => hotel.rooms >= 25 && hotel.rooms < 40).length },
    { label: "Under 25 rooms", value: state.hotels.filter((hotel) => hotel.rooms < 25).length }
  ];
  renderRankedList("[data-room-chart]", segments, state.hotels.length, "hotels");
}

function renderRankedList(selector, items, total, unit) {
  const root = document.querySelector(selector);
  const max = Math.max(...items.map((item) => item.value), 1);
  root.innerHTML = items.length
    ? items
      .map((item) => `
          <article class="ranked-item">
            <div>
              <span>${escapeHtml(item.label)}</span>
              <strong>${item.value} ${escapeHtml(unit)}</strong>
            </div>
            <div class="bar-track"><div class="bar-fill muted" style="width:${Math.max(5, Math.round((item.value / max) * 100))}%"></div></div>
            <small>${total ? Math.round((item.value / total) * 100) : 0}%</small>
          </article>
        `)
      .join("")
    : `<div class="empty-state">No data available.</div>`;
}

function renderOverviewLists(state) {
  const analysis = analyzeState(state);
  document.querySelector("[data-pending-count]").textContent = `${analysis.pending} pending`;
  document.querySelector("[data-payment-total]").textContent = formatCurrency(analysis.paidRevenue);

  const recentBookings = state.bookings.slice(0, 5);
  document.querySelector("[data-recent-bookings]").innerHTML = recentBookings.length
    ? recentBookings.map((booking) => compactBookingItem(state, booking)).join("")
    : `<div class="empty-state">No bookings yet.</div>`;

  document.querySelector("[data-payment-monitor]").innerHTML = state.bookings.length
    ? state.bookings
      .slice(0, 5)
      .map((booking) => {
        const hotel = findHotel(state, booking.hotelId);
        const user = findUser(state, booking.userId);
        const totalCost = hotel ? Number(hotel.price || 0) * getBookingNights(booking) : 0;
        return `
            <article class="compact-item">
              <h3>${escapeHtml(user?.name || "Unknown guest")}</h3>
              <p>${escapeHtml(hotel?.name || "Hotel removed")} / ${escapeHtml(formatCurrency(totalCost))}</p>
              <div class="action-row">
                ${statusPill(booking.payment === "paid" ? (booking.status === "approved" ? "paid" : "under-review") : "unpaid")}
                ${statusPill(booking.status)}
              </div>
            </article>
          `;
      })
      .join("")
    : `<div class="empty-state">No payments yet.</div>`;
}

function compactBookingItem(state, booking) {
  const hotel = findHotel(state, booking.hotelId);
  const user = findUser(state, booking.userId);
  const totalCost = hotel ? Number(hotel.price || 0) * getBookingNights(booking) : 0;
  return `
    <article class="compact-item">
      <h3>${escapeHtml(hotel?.name || "Hotel removed")}</h3>
      <p>${escapeHtml(user?.name || "Unknown guest")} / ${escapeHtml(booking.checkIn)} to ${escapeHtml(booking.checkOut)} / ${escapeHtml(formatCurrency(totalCost))}</p>
      <div class="action-row">
        ${statusPill(booking.status)}
        ${statusPill(booking.payment === "paid" ? (booking.status === "approved" ? "paid" : "under-review") : "unpaid")}
      </div>
    </article>
  `;
}

function analyzeState(state) {
  const paidBookings = state.bookings.filter((booking) => booking.payment === "paid");
  return {
    bookingTotal: state.bookings.length,
    pending: state.bookings.filter((booking) => booking.status === "pending").length,
    approved: state.bookings.filter((booking) => booking.status === "approved").length,
    rejected: state.bookings.filter((booking) => booking.status === "rejected").length,
    paidBookings: paidBookings.length,
    unpaidBookings: state.bookings.filter((booking) => booking.payment !== "paid").length,
    paidRevenue: getBookingsRevenue(state, paidBookings),
    totalRooms: state.hotels.reduce((sum, hotel) => sum + Number(hotel.rooms || 0), 0),
    averageRating: average(state.hotels.map((hotel) => Number(hotel.rating || 0))),
    cityCount: groupCount(state.hotels, (hotel) => hotel.city).length
  };
}

function getBookingsRevenue(state, bookings) {
  return bookings.reduce((total, booking) => {
    const hotel = findHotel(state, booking.hotelId);
    if (!hotel || booking.payment !== "paid") return total;
    return total + Number(hotel.price || 0) * getBookingNights(booking);
  }, 0);
}

function getBookingNights(booking) {
  if (!booking.checkIn || !booking.checkOut) return 1;
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  const diffDays = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays || 1);
}

function groupCount(items, getKey) {
  const counts = new Map();
  items.forEach((item) => {
    const key = getKey(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function legendItem(label, value, tone) {
  return `
    <span class="legend-item ${tone}">
      <i></i>
      ${escapeHtml(label)}
      <strong>${Number(value)}</strong>
    </span>
  `;
}

function shortenHotelName(name) {
  return String(name)
    .replace(/\s+(Hotel|Resort|Retreat|Suites|House|Residence|Lodge|Inn)$/i, "")
    .slice(0, 18);
}

function buildingIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V5.8C4 4.8 4.8 4 5.8 4h8.4c1 0 1.8.8 1.8 1.8V21M16 9h2.2c1 0 1.8.8 1.8 1.8V21M8 8h4M8 12h4M8 16h4M3 21h18"/></svg>`;
}

function calendarIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M6 5h12c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2z"/></svg>`;
}

function dollarIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
}

function roomIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19V7M21 19v-5.5A3.5 3.5 0 0 0 17.5 10H12v9M3 14h18M3 10h6a3 3 0 0 1 3 3v1M3 19h18"/></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function initChartTooltips() {
  const tooltip = document.querySelector("[data-chart-tooltip]");
  if (!tooltip) return;

  document.body.addEventListener("mouseover", (e) => {
    const trigger = e.target.closest("[data-tooltip-title]");
    if (!trigger) {
      tooltip.classList.remove("active");
      return;
    }

    const title = trigger.getAttribute("data-tooltip-title");
    const value = trigger.getAttribute("data-tooltip-value");

    tooltip.innerHTML = `
      <strong>${value}</strong>
      <span>${title}</span>
    `;
    tooltip.classList.add("active");
  });

  document.body.addEventListener("mousemove", (e) => {
    if (!tooltip.classList.contains("active")) return;
    tooltip.style.left = `${e.pageX}px`;
    tooltip.style.top = `${e.pageY}px`;
  });

  document.body.addEventListener("mouseout", (e) => {
    const trigger = e.target.closest("[data-tooltip-title]");
    if (trigger) {
      tooltip.classList.remove("active");
    }
  });
}

function findHotel(state, id) {
  return state.hotels.find((item) => item.id === id);
}

function findUser(state, id) {
  return state.users.find((item) => item.id === id);
}

function statusPill(status) {
  const formatted = String(status || "").replaceAll(" ", "-").toLowerCase();
  return `<span class="status-pill ${formatted}">${escapeHtml(status)}</span>`;
}
