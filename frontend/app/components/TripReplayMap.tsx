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

const containerStyle = { width: "100%", height: "100%" };

export default function TripReplayMap({ tripId }: { tripId: string }) {
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    });

    const [path, setPath] = useState<PathPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [scrubIndex, setScrubIndex] = useState(0);

    useEffect(() => {
        apiRequest<PathPoint[]>(`/api/trips/${tripId}/path`)
            .then((data) => {
                setPath(data);
                setScrubIndex(Math.max(data.length - 1, 0));
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [tripId]);

    if (loading || !isLoaded) return <p className="text-sm text-gray-500">Loading route…</p>;

    if (path.length === 0) {
        return (
            <div className="bg-gray-50 rounded-lg p-8 text-center text-sm text-gray-400">
                No location data recorded for this trip.
            </div>
        );
    }

    const center = { lat: path[0].latitude, lng: path[0].longitude };
    const polylinePath = path.map((p) => ({ lat: p.latitude, lng: p.longitude }));
    const current = path[scrubIndex];

    return (
        <div>
            <p className="text-xs text-gray-400 mb-2">
                Full GPS route for this trip — drag the slider below to scrub through it.
            </p>
            <div className="bg-white rounded-lg overflow-hidden mb-3">
                <div className="h-[400px] w-full">
                    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13}>
                        {/* The full path, drawn as a line */}
                        <Polyline
                            path={polylinePath}
                            options={{ strokeColor: "#4ade80", strokeWeight: 4, strokeOpacity: 0.8 }}
                        />

                        {/* Start marker */}
                        <OverlayView position={polylinePath[0]} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: "translate(-50%, -100%)" }}>
                                <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center">
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
            <div className="bg-white rounded-lg p-4">
                <input
                    type="range"
                    min={0}
                    max={path.length - 1}
                    value={scrubIndex}
                    onChange={(e) => setScrubIndex(Number(e.target.value))}
                    className="w-full accent-green-500"
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