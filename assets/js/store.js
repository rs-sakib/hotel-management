import { seedData } from "./data.js";

const STORAGE_KEY = "azurestay-state-v1";
const SESSION_KEY = "azurestay-current-user";
export const ADMIN_EMAIL = "admin@sakib.com";
export const ADMIN_PASSWORD = "admin1234";
export const ADMIN_USER_ID = "u-admin";
const LEGACY_DEMO_BOOKING_IDS = new Set(["b-1", "b-2"]);

const clone = (value) => JSON.parse(JSON.stringify(value));

export function getState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initialState = normalizeState(clone(seedData));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }
  const state = JSON.parse(stored);
  const beforeNormalize = JSON.stringify(state);
  const normalized = normalizeState(state);
  if (beforeNormalize !== JSON.stringify(normalized)) {
    saveState(normalized);
  }
  return normalized;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function updateState(mutator) {
  const state = getState();
  mutator(state);
  saveState(state);
  return state;
}

export function resetDemoData() {
  const initialState = clone(seedData);
  saveState(initialState);
  return initialState;
}

export function getCurrentUser() {
  const state = getState();
  const userId = localStorage.getItem(SESSION_KEY);
  return state.users.find((user) => user.id === userId) || null;
}

export function setCurrentUser(userId) {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearCurrentUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function findHotel(state, hotelId) {
  return state.hotels.find((hotel) => hotel.id === hotelId);
}

export function findUser(state, userId) {
  return state.users.find((user) => user.id === userId);
}

export function isAdminUser(user) {
  return Boolean(user && user.role === "admin" && user.id === ADMIN_USER_ID);
}

function normalizeState(state) {
  state.users = state.users || [];
  state.hotels = state.hotels || [];
  state.trips = state.trips || [];
  state.bookings = state.bookings || [];
  state.tripBookings = state.tripBookings || [];
  state.bookings = state.bookings.filter((booking) => !LEGACY_DEMO_BOOKING_IDS.has(booking.id));
  const adminUser = state.users.find((user) => user.id === ADMIN_USER_ID) || state.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL);

  state.users.forEach((user) => {
    if (user.id !== ADMIN_USER_ID && user.email?.toLowerCase() !== ADMIN_EMAIL && user.role === "admin") {
      user.role = "guest";
    }
  });

  if (adminUser) {
    adminUser.id = ADMIN_USER_ID;
    adminUser.name = adminUser.name || "Sakib Admin";
    adminUser.email = adminUser.email || ADMIN_EMAIL;
    adminUser.phone = adminUser.phone || "+880 1700 111111";
    adminUser.password = adminUser.password || ADMIN_PASSWORD;
    adminUser.role = "admin";
    adminUser.status = adminUser.status || "Active";
    adminUser.title = adminUser.title || "Operations Director";
    adminUser.department = adminUser.department || "Hotel Operations";
    adminUser.location = adminUser.location || "Dhaka HQ";
    adminUser.bio = adminUser.bio || "Responsible for booking approvals, hotel portfolio performance, guest operations, and payment monitoring.";
  } else {
    state.users.unshift({
      id: ADMIN_USER_ID,
      name: "Sakib Admin",
      email: ADMIN_EMAIL,
      phone: "+880 1700 111111",
      password: ADMIN_PASSWORD,
      role: "admin",
      status: "Active",
      title: "Operations Director",
      department: "Hotel Operations",
      location: "Dhaka HQ",
      bio: "Responsible for booking approvals, hotel portfolio performance, guest operations, and payment monitoring."
    });
  }

  return state;
}
