"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, OverlayView, Circle, useJsApiLoader } from "@react-google-maps/api";
import { IoCarSportSharp } from "react-icons/io5";
import { apiRequest } from "../lib/api";
import { usePulseColor } from "../lib/usePulseColor";
import StatCard from "./StatCard";
import CircleStat from "./CircleStat";
import FullPageLoading from "./FullPageLoading";
import { GeofenceRecord } from "../types/auth";

interface LiveVehicle {
  vehicleId: string;
  plateNumber: string;
  status: string;
  lastLocation: { latitude: number; longitude: number; recordedAt: string } | null;
}

const statusColor: Record<string, string> = {
  active: "#2dd4bf",
  idle: "#fb923c",
  offline: "#9ca3af",
  maintenance: "#f87171",
};

const LEGEND_ITEMS = [
  { label: "Active — currently moving", color: "#2dd4bf" },
  { label: "Idle — stationary, engine on", color: "#fb923c" },
  { label: "Offline — no recent signal", color: "#9ca3af" },
  { label: "Maintenance — out of service", color: "#f87171" },
];

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 };

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Great-circle distance between two lat/lng points, in meters
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// A vehicle only counts as "outside" a geofence when at least one zone
// exists to be outside of — with none defined there's nothing to violate.
function isOutsideGeofences(lat: number, lng: number, geofences: GeofenceRecord[]) {
  const circles = geofences.filter(
    (g): g is GeofenceRecord & { centerLat: number; centerLng: number; radiusM: number } =>
      g.type === "circle" && g.centerLat != null && g.centerLng != null && g.radiusM != null
  );
  if (circles.length === 0) return false;
  return !circles.some((g) => distanceMeters(lat, lng, g.centerLat, g.centerLng) <= g.radiusM);
}

function VehicleMarker({
  vehicle,
  outOfGeofence,
  onClick,
}: {
  vehicle: LiveVehicle;
  outOfGeofence: boolean;
  onClick: () => void;
}) {
  const color = statusColor[vehicle.status] || "#9ca3af";

  return (
    <div
      className="flex flex-col items-center cursor-pointer"
      style={{ transform: "translate(-50%, -100%)" }}
      onClick={onClick}
    >
      <div
        className="mb-1 px-2 py-1 rounded-md shadow-sm bg-white border text-xs whitespace-nowrap"
        style={{ borderColor: outOfGeofence ? "#ef4444" : color }}
      >
        <span className="font-semibold text-gray-900">{vehicle.plateNumber}</span>
        <span className="text-gray-400"> · </span>
        <span style={{ color }}>{vehicle.status}</span>
        {vehicle.lastLocation && (
          <>
            <span className="text-gray-400"> · </span>
            <span className="text-gray-500">{timeAgo(vehicle.lastLocation.recordedAt)}</span>
          </>
        )}
        {outOfGeofence && (
          <>
            <span className="text-gray-400"> · </span>
            <span className="text-red-500 font-medium">outside zone</span>
          </>
        )}
      </div>

      <div className="relative w-8 h-8">
        {outOfGeofence && (
          <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping" />
        )}
        <div
          className="relative w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow hover:scale-110 transition-transform"
          style={{ background: outOfGeofence ? "#ef4444" : color }}
        >
          <IoCarSportSharp size={14} color="white" />
        </div>
      </div>
    </div>
  );
}

export default function FleetMap({ basePath = "/admin/vehicles" }: { basePath?: string }) {
  const router = useRouter();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const zoneColor = usePulseColor();

  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);

  async function load() {
    try {
      const [vehicleData, geofenceData] = await Promise.all([
        apiRequest<LiveVehicle[]>("/api/tracking/live"),
        apiRequest<GeofenceRecord[]>("/api/geofences"),
      ]);
      setVehicles(vehicleData);
      setGeofences(geofenceData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const withLocation = vehicles.filter((v) => v.lastLocation);
  const center =
    withLocation.length > 0
      ? { lat: withLocation[0].lastLocation!.latitude, lng: withLocation[0].lastLocation!.longitude }
      : defaultCenter;

  const counts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
  };

  const reportingPct = counts.total ? Math.round((withLocation.length / counts.total) * 100) : 0;

  const mostRecent = withLocation.length
    ? withLocation.reduce((latest, v) =>
        new Date(v.lastLocation!.recordedAt) > new Date(latest.lastLocation!.recordedAt) ? v : latest
      )
    : null;

  if (loading || !isLoaded) return <FullPageLoading label="Loading map" />;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Map — takes the big central space */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden mb-3">
          <div className="h-[calc(100vh-260px)] min-h-[520px] w-full">
            <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={12}>
              {/* Geofence zones */}
              {showGeofences &&
                geofences.map(
                  (g) =>
                    g.type === "circle" &&
                    g.centerLat &&
                    g.centerLng && (
                      <Circle
                        key={g._id}
                        center={{ lat: g.centerLat, lng: g.centerLng }}
                        radius={g.radiusM}
                        options={{
                          fillColor: zoneColor,
                          fillOpacity: 0.12,
                          strokeColor: zoneColor,
                          strokeWeight: 1.5,
                          clickable: false,
                        }}
                      />
                    )
                )}

              {/* Vehicles */}
              {withLocation.map((v) => (
                <OverlayView
                  key={v.vehicleId}
                  position={{ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <VehicleMarker
                    vehicle={v}
                    outOfGeofence={isOutsideGeofences(
                      v.lastLocation!.latitude,
                      v.lastLocation!.longitude,
                      geofences
                    )}
                    onClick={() => router.push(`${basePath}/${v.vehicleId}`)}
                  />
                </OverlayView>
              ))}
            </GoogleMap>
          </div>

          {/* Geofence toggle */}
          {geofences.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {geofences.length} geofence{geofences.length !== 1 ? "s" : ""} on this map
              </span>
              <button
                onClick={() => setShowGeofences((s) => !s)}
                className="text-xs text-teal-600 hover:underline"
              >
                {showGeofences ? "Hide zones" : "Show zones"}
              </button>
            </div>
          )}

          {withLocation.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No vehicle location data yet — vehicles will appear once GPS pings start coming in.
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4 mb-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Marker colors</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: item.color }} />
                <span className="text-xs text-gray-600">{item.label}</span>
              </div>
            ))}
            {geofences.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-teal-400 bg-teal-400/20" />
                <span className="text-xs text-gray-600">Geofence zone</span>
              </div>
            )}
            {geofences.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="relative w-3 h-3">
                  <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative block w-3 h-3 rounded-full bg-red-500" />
                </span>
                <span className="text-xs text-gray-600">Vehicle outside geofence</span>
              </div>
            )}
          </div>
        </div>

        {/* Reporting % + freshness — below the map */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CircleStat
            percentage={reportingPct}
            label="Vehicles reporting location"
            color="#2dd4bf"
            description="Share of the fleet with a live GPS fix right now"
          />
          <StatCard
            label="Most recent update"
            value={mostRecent ? timeAgo(mostRecent.lastLocation!.recordedAt) : "—"}
            accent="green"
            description={mostRecent ? `From ${mostRecent.plateNumber}` : "No GPS pings received yet"}
            background="bg-teal-300"
            light
          />
        </div>
      </div>

      {/* Stat cards — stacked in a column on the right */}
      <div className="flex flex-col gap-4 lg:w-72 xl:w-80 lg:flex-shrink-0">
        <StatCard label="Total vehicles" value={counts.total} accent="green" />
        <StatCard label="Active" value={counts.active} accent="green" />
        <StatCard label="Idle" value={counts.idle} accent="orange" />
        <StatCard label="Offline" value={counts.offline} accent="orange" />
      </div>
    </div>
  );
}




