import { GeofenceRecord } from "../types/auth";
import { isOutsideGeofences } from "../lib/geofence";

interface LastLocation {
  latitude: number;
  longitude: number;
}

const badgeClass = "text-xs px-2 py-1 rounded-full border font-medium whitespace-nowrap";

// Shows whether a vehicle's last known position falls inside one of the
// company's geofence zones ("In zone") or not ("Out of zone") — used
// anywhere a vehicle is listed (VehiclesList) or shown on its own
// (vehicle detail pages), so it reads the same way everywhere.
export default function ZoneStatusBadge({
  lastLocation,
  geofences,
}: {
  lastLocation: LastLocation | null | undefined;
  geofences: GeofenceRecord[];
}) {
  if (geofences.length === 0) {
    return <span className={`${badgeClass} bg-gray-100 text-gray-500 border-gray-200`}>No zones set</span>;
  }

  if (!lastLocation) {
    return <span className={`${badgeClass} bg-gray-100 text-gray-500 border-gray-200`}>No signal</span>;
  }

  const outside = isOutsideGeofences(lastLocation.latitude, lastLocation.longitude, geofences);

  return outside ? (
    <span className={`${badgeClass} bg-red-50 text-red-600 border-red-200`}>Out of zone</span>
  ) : (
    <span className={`${badgeClass} bg-teal-50 text-teal-600 border-teal-200`}>In zone</span>
  );
}
