import { seedData } from "./data.js";

const STORAGE_KEY = "azurestay-state-v1";
const SESSION_KEY = "azurestay-current-user";

const clone = (value) => JSON.parse(JSON.stringify(value));

export function getState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initialState = clone(seedData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }
  return JSON.parse(stored);
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
