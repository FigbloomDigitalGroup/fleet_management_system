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
