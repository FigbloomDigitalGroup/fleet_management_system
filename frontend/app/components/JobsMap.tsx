"use client";

import { useEffect, useState } from "react";
import { GoogleMap, OverlayView, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { JobRecord } from "../types/auth";
import { FleetTheme } from "../lib/themes";

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 };

// One colour per driver so each driver's run reads as a group on the map.
// The first two are the company theme's main and accent colours.
const DRIVER_COLORS = ["#2563eb", "#9333ea", "#db2777", "#65a30d", "#ca8a04", "#0891b2"];

export function driverColor(index: number, theme: FleetTheme) {
  const colors = [theme.main[6], theme.accent[5], ...DRIVER_COLORS];
  return colors[index % colors.length];
}

// An optimized run's road line; `start` is where the vehicle was when it
// was optimized (null when the run starts at the first stop).
export interface JobsMapRoute {
  key: string;
  color: string;
  path: { lat: number; lng: number }[];
  start: { lat: number; lng: number } | null;
}

export default function JobsMap({
  jobs,
  routes = [],
  colorFor,
  onSelect,
}: {
  jobs: JobRecord[];
  routes?: JobsMapRoute[];
  colorFor: (job: JobRecord) => string;
  onSelect: (job: JobRecord) => void;
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Re-fit whenever the set of plotted jobs changes (new day, new job…).
  const fitKey = [...jobs.map((j) => `${j._id}:${j.latitude},${j.longitude}`), ...routes.map((r) => r.key)].join("|");
  useEffect(() => {
    if (!map || jobs.length === 0) return;
    if (jobs.length === 1 && routes.length === 0) {
      map.panTo({ lat: jobs[0].latitude, lng: jobs[0].longitude });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    jobs.forEach((j) => bounds.extend({ lat: j.latitude, lng: j.longitude }));
    routes.forEach((r) => r.path.forEach((p) => bounds.extend(p)));
    map.fitBounds(bounds, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  if (!isLoaded) return <div className="skeleton-shimmer h-full w-full rounded" />;

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={defaultCenter} zoom={11} onLoad={setMap}>
      {routes.map((r) => (
        <Polyline
          key={r.key}
          path={r.path}
          options={{ strokeColor: r.color, strokeOpacity: 0.85, strokeWeight: 5, clickable: false, zIndex: 1 }}
        />
      ))}
      {routes.map(
        (r) =>
          r.start && (
            <OverlayView key={`${r.key}-start`} position={r.start} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <span
                title="Where the vehicle was when the route was optimized"
                style={{ transform: "translate(-50%, -50%)", borderColor: r.color }}
                className="block h-4 w-4 rounded-full border-4 bg-white shadow"
              />
            </OverlayView>
          )
      )}
      {jobs.map((job) => (
        <OverlayView
          key={job._id}
          position={{ lat: job.latitude, lng: job.longitude }}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <button
            type="button"
            onClick={() => onSelect(job)}
            title={`${job.sequence}. ${job.title}`}
            style={{ transform: "translate(-50%, -50%)", background: colorFor(job) }}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow ${
              job.status === "completed" || job.status === "cancelled" ? "opacity-50" : ""
            }`}
          >
            {job.sequence}
          </button>
        </OverlayView>
      ))}
    </GoogleMap>
  );
}
