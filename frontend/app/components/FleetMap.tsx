"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, OverlayView, Circle, useJsApiLoader } from "@react-google-maps/api";
import { FaTruck } from "react-icons/fa";
import { apiRequest } from "../lib/api";
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
  active: "#4ade80",
  idle: "#fb923c",
  offline: "#9ca3af",
  maintenance: "#f87171",
};

const LEGEND_ITEMS = [
  { label: "Active — currently moving", color: "#4ade80" },
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

function VehicleMarker({ vehicle, onClick }: { vehicle: LiveVehicle; onClick: () => void }) {
  const color = statusColor[vehicle.status] || "#9ca3af";

  return (
    <div
      className="flex flex-col items-center cursor-pointer"
      style={{ transform: "translate(-50%, -100%)" }}
      onClick={onClick}
    >
      <div
        className="mb-1 px-2 py-1 rounded-md shadow-sm bg-white border text-xs whitespace-nowrap"
        style={{ borderColor: color }}
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
      </div>

      <div
        className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow hover:scale-110 transition-transform"
        style={{ background: color }}
      >
        <FaTruck size={14} color="white" />
      </div>
    </div>
  );
}

export default function FleetMap({ basePath = "/admin/vehicles" }: { basePath?: string }) {
  const router = useRouter();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

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
    <div>
      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total vehicles" value={counts.total} accent="green" />
        <StatCard label="Active" value={counts.active} accent="green" />
        <StatCard label="Idle" value={counts.idle} accent="orange" />
        <StatCard label="Offline" value={counts.offline} accent="orange" />
      </div>

      {/* Map */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-3">
        <div className="h-[500px] w-full">
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
                        fillColor: "#4ade80",
                        fillOpacity: 0.12,
                        strokeColor: "#4ade80",
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
                <VehicleMarker vehicle={v} onClick={() => router.push(`${basePath}/${v.vehicleId}`)} />
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
              className="text-xs text-green-600 hover:underline"
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
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
              <span className="w-3 h-3 rounded-full border-2 border-green-400 bg-green-400/20" />
              <span className="text-xs text-gray-600">Geofence zone</span>
            </div>
          )}
        </div>
      </div>

      {/* Reporting % + freshness */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CircleStat percentage={reportingPct} label="Vehicles reporting location" color="#4ade80" />
        <StatCard
          label="Most recent update"
          value={mostRecent ? timeAgo(mostRecent.lastLocation!.recordedAt) : "—"}
          accent="green"
        />
      </div>
    </div>
  );
}




