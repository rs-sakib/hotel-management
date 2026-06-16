import { seedData } from "./data.js";

const STORAGE_KEY = "azurestay-state-v1";
const SESSION_KEY = "azurestay-current-user";
export const ADMIN_EMAIL = "admin@sakib.com";
export const ADMIN_PASSWORD = "admin1234";
export const ADMIN_USER_ID = "u-admin";

const clone = (value) => JSON.parse(JSON.stringify(value));

export function getState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initialState = normalizeState(clone(seedData));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }
  const state = JSON.parse(stored);
  const normalized = normalizeState(state);
  if (JSON.stringify(state.users) !== JSON.stringify(normalized.users)) {
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
  return Boolean(user && user.role === "admin" && user.email.toLowerCase() === ADMIN_EMAIL);
}

function normalizeState(state) {
  state.users = state.users || [];
  const adminUser = state.users.find((user) => user.id === ADMIN_USER_ID) || state.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL);

  state.users.forEach((user) => {
    if (user.email?.toLowerCase() !== ADMIN_EMAIL && user.role === "admin") {
      user.role = "guest";
    }
  });

  if (adminUser) {
    adminUser.id = ADMIN_USER_ID;
    adminUser.name = "Sakib Admin";
    adminUser.email = ADMIN_EMAIL;
    adminUser.phone = adminUser.phone || "+880 1700 111111";
    adminUser.password = ADMIN_PASSWORD;
    adminUser.role = "admin";
    adminUser.status = "Active";
  } else {
    state.users.unshift({
      id: ADMIN_USER_ID,
      name: "Sakib Admin",
      email: ADMIN_EMAIL,
      phone: "+880 1700 111111",
      password: ADMIN_PASSWORD,
      role: "admin",
      status: "Active"
    });
  }

  return state;
}
