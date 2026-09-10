
"use client";

import { useEffect, useState } from "react";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { apiRequest } from "../lib/api";
import StatCard from "./StatCard";
import FullPageLoading from "./FullPageLoading";
import CircleStat from "./CircleStat";

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

export default function FleetMap() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LiveVehicle | null>(null);

  async function load() {
    try {
      const data = await apiRequest<LiveVehicle[]>("/api/tracking/live");
      setVehicles(data);
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

  // Average speed-derived metric: how many vehicles are actually reporting a location at all
  const reportingPct = counts.total ? Math.round((withLocation.length / counts.total) * 100) : 0;

  // Most recently updated vehicle — a quick "freshness" indicator
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
    <div className="bg-white rounded-lg overflow-hidden mb-6">
      <div className="h-[500px] w-full">
        <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={12}>
          {withLocation.map((v) => (
            <Marker
              key={v.vehicleId}
              position={{ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: statusColor[v.status] || "#9ca3af",
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2,
              }}
              onClick={() => setSelected(v)}
            />
          ))}

          {selected && selected.lastLocation && (
            <InfoWindow
              position={{ lat: selected.lastLocation.latitude, lng: selected.lastLocation.longitude }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="text-sm">
                <strong>{selected.plateNumber}</strong>
                <br />
                Status: {selected.status}
                <br />
                Updated: {timeAgo(selected.lastLocation.recordedAt)}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
      {withLocation.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          No vehicle location data yet — vehicles will appear once GPS pings start coming in.
        </p>
      )}
    </div>

    {/* Legend */}
    <div className="bg-white rounded-lg p-4 mb-6">
      <p className="text-xs font-medium text-gray-500 mb-2">Marker colors</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: item.color }} />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
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
)
}






