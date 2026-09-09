"use client";

import { useEffect, useState } from "react";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { apiRequest } from "../lib/api";
import StatCard from "./StatCard";
import Skeleton from "./Skeleton";

interface LiveVehicle {
  vehicleId: string;
  plateNumber: string;
  status: string;
  lastLocation: { latitude: number; longitude: number; recordedAt: string } | null;
}

const statusColor: Record<string, string> = {
  active: "#16a34a",
  idle: "#ea580c",
  offline: "#9ca3af",
  maintenance: "#f87171",
};

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 }; // Nairobi fallback

export default function FleetMap({ compact = false }: { compact?: boolean }) {
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

  if (loading || !isLoaded)
    return <Skeleton rows={1} rowClassName="h-full min-h-[240px]" className="h-full" />;

  const map = (
    <div className="relative h-full w-full">
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
              Updated: {new Date(selected.lastLocation.recordedAt).toLocaleTimeString()}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      {withLocation.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-gray-400">
          No vehicle location data yet — vehicles will appear once GPS pings start coming in.
        </p>
      )}
    </div>
  );

  // Embedded as a dashboard preview: same stat cards as the top row, sized to fit
  // whatever height the page gives this (flex column instead of a fixed map height).
  if (compact) {
    return (
      <div className="flex h-full flex-col">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 shrink-0">
          <StatCard label="Total vehicles" value={counts.total} accent="blue" />
          <StatCard label="Active" value={counts.active} accent="green" />
          <StatCard label="Idle" value={counts.idle} accent="orange" />
          <StatCard label="Offline" value={counts.offline} accent="orange" />
        </div>
        <div className="relative min-h-0 flex-1">{map}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total vehicles" value={counts.total} accent="blue" />
        <StatCard label="Active" value={counts.active} accent="green" />
        <StatCard label="Idle" value={counts.idle} accent="orange" />
        <StatCard label="Offline" value={counts.offline} accent="orange" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-[500px] w-full">{map}</div>
      </div>
    </div>
  );
}