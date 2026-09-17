import { GeofenceRecord } from "../types/auth";

// Great-circle distance between two lat/lng points, in meters
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isPointInPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]) {
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

export function isInsideGeofence(lat: number, lng: number, geofence: GeofenceRecord) {
  if (geofence.type === "circle" && geofence.centerLat != null && geofence.centerLng != null && geofence.radiusM != null) {
    return distanceMeters(lat, lng, geofence.centerLat, geofence.centerLng) <= geofence.radiusM;
  }
  if (geofence.type === "polygon" && geofence.polygon && geofence.polygon.length >= 3) {
    return isPointInPolygon(lat, lng, geofence.polygon);
  }
  return false;
}

// A point only counts as "outside" when at least one usable zone exists to
// be outside of — with none defined there's nothing to violate.
export function isOutsideGeofences(lat: number, lng: number, geofences: GeofenceRecord[]) {
  const usable = geofences.filter(
    (g) =>
      (g.type === "circle" && g.centerLat != null && g.centerLng != null && g.radiusM != null) ||
      (g.type === "polygon" && g.polygon && g.polygon.length >= 3)
  );
  if (usable.length === 0) return false;
  return !usable.some((g) => isInsideGeofence(lat, lng, g));
}

export function findContainingGeofence(lat: number, lng: number, geofences: GeofenceRecord[]) {
  return geofences.find((g) => isInsideGeofence(lat, lng, g)) || null;
}
