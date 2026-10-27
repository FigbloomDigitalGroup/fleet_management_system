// Turns a coordinate into a street address for the Live Map's vehicle card.
// Tries Google's Geocoding API first (same key as the rest of googleMapsService);
// while that API isn't enabled on the Google project, falls back to
// OpenStreetMap's free Nominatim service. Only the address text comes from
// here — the map itself is still Google's.

const GOOGLE_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
// Nominatim's usage policy: identify the app, and at most one request a second.
const NOMINATIM_USER_AGENT = "FigbloomFleet/1.0 (fleet tracking dashboard)";
const NOMINATIM_GAP_MS = 1100;

// ~11 m buckets — close enough that a parked vehicle never triggers a new
// lookup, and a busy fleet re-uses each other's results.
const CACHE_MAX = 5000;
const cache = new Map();

// After Google says the API is off, don't ask it again for an hour.
const GOOGLE_RETRY_MS = 60 * 60 * 1000;
let googleUnavailableUntil = 0;

let nominatimQueue = Promise.resolve();
let lastNominatimAt = 0;

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

async function fromGoogle(lat, lng) {
  if (!GOOGLE_KEY || Date.now() < googleUnavailableUntil) return null;
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`);
  const data = await res.json();
  if (data.status === "OK") return data.results[0]?.formatted_address || null;
  if (data.status === "REQUEST_DENIED") googleUnavailableUntil = Date.now() + GOOGLE_RETRY_MS;
  return null;
}

// Nominatim's display_name lists every admin level ("… Kilimani location,
// Kilimani ward, Kilimani division …"); keep place, road, area and town.
function shortNominatimAddress(data) {
  const a = data.address || {};
  const road = [a.house_number, a.road].filter(Boolean).join(" ");
  const parts = [
    data.name && data.name !== a.road ? data.name : null,
    road,
    a.suburb || a.neighbourhood || a.quarter,
    a.city || a.town || a.village || a.county,
  ].filter(Boolean);
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length ? unique.join(", ") : data.display_name || null;
}

// Serialised so concurrent lookups still respect the one-a-second limit.
function fromNominatim(lat, lng) {
  const run = nominatimQueue.then(async () => {
    const wait = lastNominatimAt + NOMINATIM_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    const res = await fetch(`${NOMINATIM_URL}?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT, "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    return shortNominatimAddress(await res.json());
  });
  nominatimQueue = run.catch(() => {});
  return run;
}

// Returns the address, or null if neither service could find one.
export async function reverseGeocode(lat, lng) {
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key);

  let address = null;
  try {
    address = await fromGoogle(lat, lng);
  } catch {
    // Network trouble reaching Google — try the fallback.
  }
  if (!address) address = await fromNominatim(lat, lng);

  if (address) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, address);
  }
  return address;
}
