"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { apiRequest } from "../lib/api";
import StatCard from "./StatCard";

// A small truck icon rendered as a colored pin, built with inline SVG (no image file needed)
function vehicleDivIcon(color: string) {
  return new L.DivIcon({
    html: `
      <div style="
        background:${color};
        width:30px;height:30px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.3);
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M4 16l1.5-5.5A2 2 0 0 1 7.4 9h9.2a2 2 0 0 1 1.9 1.5L20 16" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 16h18v3a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="7.5" cy="16" r="1.3" fill="white" stroke="none"/>
          <circle cx="16.5" cy="16" r="1.3" fill="white" stroke="none"/>
        </svg>
      </div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const statusColor: Record<string, string> = {
  active: "#4ade80", // green-400
  idle: "#fb923c", // orange-400/500
  offline: "#9ca3af", // gray-400
  maintenance: "#f87171", // red-400
};

interface LiveVehicle {
  vehicleId: string;
  plateNumber: string;
  status: string;
  lastLocation: { latitude: number; longitude: number; recordedAt: string } | null;
}

export default function FleetMap() {
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [loading, setLoading] = useState(true);

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
  const center: [number, number] =
    withLocation.length > 0
      ? [withLocation[0].lastLocation!.latitude, withLocation[0].lastLocation!.longitude]
      : [-1.2921, 36.8219];

  const counts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
  };

  if (loading) return <p className="text-sm text-gray-500">Loading map…</p>;

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total vehicles" value={counts.total} accent="green" />
        <StatCard label="Active" value={counts.active} accent="green" />
        <StatCard label="Idle" value={counts.idle} accent="orange" />
        <StatCard label="Offline" value={counts.offline} accent="orange" />
      </div>

      {/* Map */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-[500px] w-full">
          <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {withLocation.map((v) => (
              <Marker
                key={v.vehicleId}
                position={[v.lastLocation!.latitude, v.lastLocation!.longitude]}
                icon={vehicleDivIcon(statusColor[v.status] || "#9ca3af")}
              >
                <Popup>
                  <strong>{v.plateNumber}</strong>
                  <br />
                  Status: {v.status}
                  <br />
                  Updated: {new Date(v.lastLocation!.recordedAt).toLocaleTimeString()}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        {withLocation.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            No vehicle location data yet — vehicles will appear once GPS pings start coming in.
          </p>
        )}
      </div>
    </div>
  );
}