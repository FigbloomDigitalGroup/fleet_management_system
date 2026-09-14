"use client";

import { useEffect, useState } from "react";
import { GoogleMap, Polyline, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { apiRequest } from "../lib/api";
import { FaMapMarkerAlt, FaFlagCheckered } from "react-icons/fa";

interface PathPoint {
  latitude: number;
  longitude: number;
  speedKph?: number;
  recordedAt: string;
}

const containerStyle = { width: "100%", height: "100%" };

// Pick a handful of evenly-spaced points from the full path, for a clean timeline list
function sampleWaypoints(path: PathPoint[], maxPoints = 5): PathPoint[] {
  if (path.length <= maxPoints) return path;
  const step = (path.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => path[Math.round(i * step)]);
}

export default function CompanyTripReplayMap({ tripId }: { tripId: string }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [path, setPath] = useState<PathPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<PathPoint[]>(`/api/trips/${tripId}/path`)
      .then(setPath)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading || !isLoaded) return <p className="text-sm text-gray-500">Loading journey…</p>;

  if (path.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
        No location data recorded for this trip.
      </div>
    );
  }

  const center = { lat: path[0].latitude, lng: path[0].longitude };
  const polylinePath = path.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  const waypoints = sampleWaypoints(path);
  const totalDurationMin =
    (new Date(path[path.length - 1].recordedAt).getTime() - new Date(path[0].recordedAt).getTime()) / 60000;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Map */}
      <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-[380px] w-full">
          <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13}>
            <Polyline
              path={polylinePath}
              options={{ strokeColor: "#2563eb", strokeWeight: 3, strokeOpacity: 0.7 }}
            />
            <OverlayView position={polylinePath[0]} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(-50%, -100%)" }}>
                <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow flex items-center justify-center">
                  <FaMapMarkerAlt size={11} color="white" />
                </div>
              </div>
            </OverlayView>
            <OverlayView
              position={polylinePath[polylinePath.length - 1]}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div style={{ transform: "translate(-50%, -100%)" }}>
                <div className="w-7 h-7 rounded-full bg-gray-700 border-2 border-white shadow flex items-center justify-center">
                  <FaFlagCheckered size={11} color="white" />
                </div>
              </div>
            </OverlayView>
          </GoogleMap>
        </div>
      </div>

      {/* Journey summary timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Journey summary</p>
        <p className="text-sm text-gray-900 font-semibold mb-4">
          {totalDurationMin > 0 ? `${totalDurationMin.toFixed(0)} min journey` : "In progress"}
        </p>

        <div className="relative pl-4">
          {/* vertical line */}
          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200" />

          {waypoints.map((point, i) => {
            const isFirst = i === 0;
            const isLast = i === waypoints.length - 1;
            return (
              <div key={i} className="relative pb-5 last:pb-0">
                <span
                  className={`absolute -left-4 top-0.5 w-3 h-3 rounded-full border-2 border-white ${
                    isFirst ? "bg-blue-600" : isLast ? "bg-gray-700" : "bg-blue-300"
                  }`}
                />
                <p className="text-xs font-medium text-gray-900">
                  {new Date(point.recordedAt).toLocaleTimeString()}
                </p>
                <p className="text-xs text-gray-400">
                  {point.speedKph ? `${point.speedKph} km/h` : "stationary"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}