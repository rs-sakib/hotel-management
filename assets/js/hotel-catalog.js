export async function loadHotelCatalog(localHotels = []) {
  const catalogHotels = await fetchCatalogHotels();
  return mergeHotels(localHotels, catalogHotels);
}

async function fetchCatalogHotels() {
  try {
    const response = await fetch(new URL("../data/hotels.json", import.meta.url));
    if (!response.ok) return [];
    const hotels = await response.json();
    return Array.isArray(hotels) ? hotels : [];
  } catch (error) {
    return [];
  }
}

function mergeHotels(primaryHotels, catalogHotels) {
  const byId = new Map();
  [...catalogHotels, ...primaryHotels].forEach((hotel) => {
    if (!hotel?.id) return;
    byId.set(hotel.id, hotel);
  });
  return [...byId.values()];
}
