"use client";

import { useEffect, useState } from "react";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { JobRecord } from "../types/auth";

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 };

// One colour per driver so each driver's run reads as a group on the map.
const DRIVER_COLORS = ["#0e4f27", "#ff8a12", "#2563eb", "#9333ea", "#db2777", "#65a30d", "#217941", "#ca8a04"];

export function driverColor(index: number) {
  return DRIVER_COLORS[index % DRIVER_COLORS.length];
}

export default function JobsMap({
  jobs,
  colorFor,
  onSelect,
}: {
  jobs: JobRecord[];
  colorFor: (job: JobRecord) => string;
  onSelect: (job: JobRecord) => void;
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Re-fit whenever the set of plotted jobs changes (new day, new job…).
  const fitKey = jobs.map((j) => `${j._id}:${j.latitude},${j.longitude}`).join("|");
  useEffect(() => {
    if (!map || jobs.length === 0) return;
    if (jobs.length === 1) {
      map.panTo({ lat: jobs[0].latitude, lng: jobs[0].longitude });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    jobs.forEach((j) => bounds.extend({ lat: j.latitude, lng: j.longitude }));
    map.fitBounds(bounds, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  if (!isLoaded) return <div className="skeleton-shimmer h-full w-full rounded" />;

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={defaultCenter} zoom={11} onLoad={setMap}>
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
