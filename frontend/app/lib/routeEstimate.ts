type LatLng = { lat: number; lng: number };

const DEFAULT_CONSUMPTION_L_PER_100KM = 12;

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function routeDistanceKm(waypoints: LatLng[]) {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) total += haversineKm(waypoints[i - 1], waypoints[i]);
  return total;
}

// A single average-consumption figure can't account for traffic, load, or
// driving style, so this is a min–max band (±10%/+15%) rather than one
// falsely precise number.
export function estimateFuelRangeLiters(distanceKm: number, avgConsumptionLPer100Km = DEFAULT_CONSUMPTION_L_PER_100KM) {
  const base = (distanceKm / 100) * avgConsumptionLPer100Km;
  return { min: base * 0.9, max: base * 1.15 };
}
