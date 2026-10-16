// Haversine distance between two lat/lng points, in km
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// No fleet vehicle on a public road legitimately covers ground faster than
// this between two fixes — anything above is a GPS glitch/spike, not travel.
export const MAX_PLAUSIBLE_SPEED_KPH = 180;

// Sums distance across a chronologically-sorted run of location pings,
// skipping fake-GPS pings and any point whose implied speed from the last
// trusted point exceeds MAX_PLAUSIBLE_SPEED_KPH. Without this, a single bad
// GPS fix that teleports away and snaps back double-counts its own jump
// distance onto the total — e.g. a stray 5km glitch and return turns a 1km
// walk into an 11km "trip" (and inflates the fuel estimate derived from it).
export function sumTripDistanceKm(pings) {
  let total = 0;
  let anchor = null;
  for (const p of pings) {
    if (p.isMocked) continue;
    if (!anchor) {
      anchor = p;
      continue;
    }
    const km = distanceKm(anchor.latitude, anchor.longitude, p.latitude, p.longitude);
    const hours = (new Date(p.recordedAt).getTime() - new Date(anchor.recordedAt).getTime()) / 3600000;
    const impliedSpeedKph = hours > 0 ? km / hours : 0;
    if (impliedSpeedKph > MAX_PLAUSIBLE_SPEED_KPH) continue; // glitch — drop it, keep the last trusted anchor
    total += km;
    anchor = p;
  }
  return total;
}

export function isPointInCircle(lat, lng, centerLat, centerLng, radiusM) {
  const distM = distanceKm(lat, lng, centerLat, centerLng) * 1000;
  return distM <= radiusM;
}

export function isPointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isInsideGeofence(lat, lng, geofence) {
  if (geofence.type === "circle") {
    return isPointInCircle(lat, lng, geofence.centerLat, geofence.centerLng, geofence.radiusM);
  }
  if (geofence.type === "polygon" && geofence.polygon?.length >= 3) {
    return isPointInPolygon(lat, lng, geofence.polygon);
  }
  return false;
}
