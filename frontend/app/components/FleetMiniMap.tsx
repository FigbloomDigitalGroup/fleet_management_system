"use client";

import { useMemo } from "react";
import Link from "next/link";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { FiArrowRight } from "react-icons/fi";
import { LiveVehicleRecord } from "../types/auth";

const containerStyle = { width: "100%", height: "100%" };
const NAIROBI = { lat: -1.2921, lng: 36.8219 };
const STATUS_COLORS: Record<string, string> = {
  active: "#16a34a",
  idle: "#f59e0b",
  offline: "#6b7280",
  maintenance: "#ef4444",
};

// The Overview's small, look-only map: where each reporting vehicle is right
// now, with a link to the full live map. It fits all reporting vehicles in
// view once, on load.
export default function FleetMiniMap({ vehicles, liveMapHref }: { vehicles: LiveVehicleRecord[]; liveMapHref: string }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const located = useMemo(() => vehicles.filter((v) => v.lastLocation), [vehicles]);

  return (
    <div className="flex h-full flex-col rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">Where your fleet is now</h3>
          <p className="mt-0.5 text-xs text-teal-600">
            {located.length} of {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} reporting a location
          </p>
        </div>
        <Link href={liveMapHref} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
          Open live map <FiArrowRight size={12} />
        </Link>
      </div>
      <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-md bg-gray-100">
        {located.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-gray-500">
            No vehicle has sent a location yet. Vehicles appear here once their tracker or driver app reports in.
          </p>
        ) : isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={NAIROBI}
            zoom={11}
            onLoad={(map) => {
              if (located.length === 1) {
                map.setCenter({ lat: located[0].lastLocation!.latitude, lng: located[0].lastLocation!.longitude });
                map.setZoom(13);
                return;
              }
              const bounds = new google.maps.LatLngBounds();
              located.forEach((v) => bounds.extend({ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }));
              map.fitBounds(bounds, 32);
            }}
            options={{ disableDefaultUI: true, gestureHandling: "cooperative", clickableIcons: false }}
          >
            {located.map((v) => (
              <OverlayView
                key={v.vehicleId}
                position={{ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <span
                  title={`${v.plateNumber} · ${v.status}`}
                  className="block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ background: STATUS_COLORS[v.status] ?? "#6b7280" }}
                />
              </OverlayView>
            ))}
          </GoogleMap>
        ) : null}
      </div>
    </div>
  );
}
