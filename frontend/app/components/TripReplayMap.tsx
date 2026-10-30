"use client";

import { useEffect, useState } from "react";
import { GoogleMap, Polyline, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { apiRequest } from "../lib/api";
import { FaFlagCheckered, FaCircle } from "react-icons/fa";

interface PathPoint {
    latitude: number;
    longitude: number;
    speedKph?: number;
    recordedAt: string;
}

// The trip's road-following line (GET /api/trips/:id/road) — null until the
// finished trip has been matched to the roads; the GPS points are drawn then.
interface TripRoad {
  snapped: boolean;
  geometry: { lat: number; lng: number }[] | null;
}

const containerStyle = { width: "100%", height: "100%" };

export default function TripReplayMap({ tripId }: { tripId: string }) {
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    });

    const [path, setPath] = useState<PathPoint[]>([]);
    const [road, setRoad] = useState<TripRoad | null>(null);
    const [loading, setLoading] = useState(true);
    const [scrubIndex, setScrubIndexState] = useState(0);

    // The full path is always re-fetched fresh from the server on every load
    // (nothing is ever actually lost), but the scrub position itself used to
    // reset to the latest point on every refresh — which looked exactly like
    // "my place in the trip got lost" even though the underlying data didn't
    // change. Persisted per-trip so a refresh resumes where you left off.
    const scrubStorageKey = `fleet:trip-scrub:${tripId}`;
    function setScrubIndex(index: number) {
        setScrubIndexState(index);
        sessionStorage.setItem(scrubStorageKey, String(index));
    }

    useEffect(() => {
        apiRequest<PathPoint[]>(`/api/trips/${tripId}/path`)
            .then((data) => {
                setPath(data);
                const saved = Number(sessionStorage.getItem(scrubStorageKey));
                const restored = Number.isFinite(saved) && saved >= 0 && saved < data.length ? saved : data.length - 1;
                setScrubIndexState(Math.max(restored, 0));
            })
            .catch(() => {}) // apiRequest has already shown the failure in a popup.
            .finally(() => setLoading(false));
        apiRequest<TripRoad>(`/api/trips/${tripId}/road`)
            .then(setRoad)
            .catch(() => setRoad(null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripId]);

    if (loading || !isLoaded) return <p className="text-sm text-gray-500">Loading route…</p>;

    if (path.length === 0) {
        return (
            <div className="bg-gray-50 rounded p-8 text-center text-sm text-gray-400">
                No location data recorded for this trip.
            </div>
        );
    }

    const center = { lat: path[0].latitude, lng: path[0].longitude };
    const polylinePath = path.map((p) => ({ lat: p.latitude, lng: p.longitude }));
    const routeLine = road?.geometry ?? polylinePath;
    const current = path[scrubIndex];

    return (
        <div>
            <p className="text-xs text-teal-600 mb-2">
                {road?.snapped
                    ? "Route matched to the roads — drag the slider below to scrub through it."
                    : "GPS route for this trip — drag the slider below to scrub through it."}
            </p>
            <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden mb-3">
                <div className="h-[400px] w-full">
                    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13}>
                        {/* The full path, drawn as a line */}
                        <Polyline
                            path={routeLine}
                            options={{ strokeColor: "#50a86a", strokeWeight: 4, strokeOpacity: 0.8 }}
                        />

                        {/* Start marker */}
                        <OverlayView position={polylinePath[0]} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: "translate(-50%, -100%)" }}>
                                <div className="w-6 h-6 rounded-full bg-teal-500 border-2 border-white shadow flex items-center justify-center">
                                    <FaCircle size={8} color="white" />
                                </div>
                            </div>
                        </OverlayView>

                        {/* End marker */}
                        <OverlayView
                            position={polylinePath[polylinePath.length - 1]}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                            <div style={{ transform: "translate(-50%, -100%)" }}>
                                <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-white shadow flex items-center justify-center">
                                    <FaFlagCheckered size={10} color="white" />
                                </div>
                            </div>
                        </OverlayView>

                        {/* Scrub position marker */}
                        <OverlayView position={{ lat: current.latitude, lng: current.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: "translate(-50%, -50%)" }}>
                                <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow" />
                            </div>
                        </OverlayView>
                    </GoogleMap>
                </div>
            </div>

            {/* Scrubber */}
            <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-4">
                <input
                    type="range"
                    min={0}
                    max={path.length - 1}
                    value={scrubIndex}
                    onChange={(e) => setScrubIndex(Number(e.target.value))}
                    className="w-full accent-teal-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{new Date(current.recordedAt).toLocaleTimeString()}</span>
                    <span>{current.speedKph ? `${current.speedKph} km/h` : "—"}</span>
                    <span>
                        Point {scrubIndex + 1} of {path.length}
                    </span>
                </div>
            </div>
        </div>
    );
}