"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { apiRequest } from "../lib/api";

interface LiveVehicle {
  vehicleId: string;
  status: string;
  lastLocation: { latitude: number; longitude: number } | null;
}

const statusColor: Record<string, string> = {
  active: "#2dd4bf",
  idle: "#fb923c",
  offline: "#9ca3af",
  maintenance: "#f87171",
};

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 };

// A small, non-interactive preview of the fleet's live positions — the whole
// card is a single click target that takes you to the full Live Map page
// (which already exists separately with search, geofences, etc.).
export default function LiveMapPreview({ href = "/company/live-map" }: { href?: string }) {
  const router = useRouter();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);

  useEffect(() => {
    function load() {
      apiRequest<LiveVehicle[]>("/api/tracking/live")
        .then(setVehicles)
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const withLocation = vehicles.filter((v) => v.lastLocation);
  const center =
    withLocation.length > 0
      ? { lat: withLocation[0].lastLocation!.latitude, lng: withLocation[0].lastLocation!.longitude }
      : defaultCenter;

  return (
    <div className="group relative h-full overflow-hidden rounded-2xl bg-gray-100 shadow-sm ring-1 ring-black/5">
      {isLoaded && (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={11}
          options={{
            disableDefaultUI: true,
            gestureHandling: "none",
            draggable: false,
            zoomControl: false,
            clickableIcons: false,
            keyboardShortcuts: false,
          }}
        >
          {withLocation.map((v) => (
            <OverlayView
              key={v.vehicleId}
              position={{ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                className="h-3.5 w-3.5 rounded-full border-2 border-white shadow"
                style={{ background: statusColor[v.status] || "#9ca3af" }}
              />
            </OverlayView>
          ))}
        </GoogleMap>
      )}

      {/* Click-through overlay — sits above the (intentionally non-interactive) map */}
      <button
        type="button"
        onClick={() => router.push(href)}
        aria-label="Open the full Live Map"
        className="absolute inset-0 z-10 cursor-pointer"
      />

      {/* Title + action float over the map instead of sitting above it, so
          the map itself fills the whole card edge to edge. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent px-4 py-3">
        <span className="inline-block rounded-md bg-white/90 px-2.5 py-1 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur">
          Live Map
        </span>
        <span className="inline-block rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors group-hover:bg-orange-600">
          Open full map
        </span>
      </div>
    </div>
  );
}
