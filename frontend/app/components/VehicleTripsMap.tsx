"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GoogleMap, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { apiRequest } from "../lib/api";
import { TripRecord } from "../types/auth";
import { estimateFuelRangeLiters } from "../lib/routeEstimate";

interface PathPoint {
  latitude: number;
  longitude: number;
}

const ROUTE_COLORS = ["#2dd4bf", "#f97316", "#6366f1", "#ec4899", "#84cc16"];
const MAX_ROUTES = 5;
const containerStyle = { width: "100%", height: "100%" };

// A compact, at-a-glance overview of a vehicle's recent completed trips —
// each drawn as its own colored line on one small map. Deliberately not a
// scrubber/replay (that already exists per-trip on the trip detail page,
// linked to from the list below) — this is just "where has this vehicle
// been lately."
export default function VehicleTripsMap({ vehicleId, basePath }: { vehicleId: string; basePath: string }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [routes, setRoutes] = useState<Record<string, PathPoint[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiRequest<TripRecord[]>(`/api/trips?vehicleId=${vehicleId}`)
      .then(async (allTrips) => {
        const completed = allTrips.filter((t) => t.endTime).slice(0, MAX_ROUTES);
        if (cancelled) return;
        setTrips(completed);

        const paths = await Promise.all(
          completed.map((t) =>
            apiRequest<PathPoint[]>(`/api/trips/${t._id}/path`)
              .then((points) => [t._id, points] as const)
              .catch(() => [t._id, []] as const)
          )
        );
        if (cancelled) return;
        setRoutes(Object.fromEntries(paths));
      })
      .catch(() => {
        if (!cancelled) setTrips([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const allPoints = useMemo(() => Object.values(routes).flat(), [routes]);

  if (loading || !isLoaded) {
    return <div className="skeleton-shimmer h-56 rounded-md" />;
  }

  if (trips.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-400">
        No completed trips recorded for this vehicle yet.
      </div>
    );
  }

  return (
    <div>
      <div className="h-56 w-full overflow-hidden rounded-md ring-1 ring-black/5">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={allPoints[0] ? { lat: allPoints[0].latitude, lng: allPoints[0].longitude } : { lat: 0, lng: 0 }}
          zoom={12}
          onLoad={(map) => {
            if (allPoints.length === 0) return;
            const bounds = new google.maps.LatLngBounds();
            allPoints.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
            map.fitBounds(bounds, 24);
          }}
          options={{ disableDefaultUI: true, zoomControl: true }}
        >
          {trips.map((trip, i) => {
            const points = routes[trip._id];
            if (!points || points.length === 0) return null;
            return (
              <Polyline
                key={trip._id}
                path={points.map((p) => ({ lat: p.latitude, lng: p.longitude }))}
                options={{ strokeColor: ROUTE_COLORS[i % ROUTE_COLORS.length], strokeWeight: 3, strokeOpacity: 0.85 }}
              />
            );
          })}
        </GoogleMap>
      </div>

      <ul className="mt-3 space-y-1.5">
        {trips.map((trip, i) => (
          <li key={trip._id}>
            <Link
              href={`${basePath}/${trip._id}`}
              className="flex items-center justify-between rounded px-2 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ROUTE_COLORS[i % ROUTE_COLORS.length] }}
                />
                {new Date(trip.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {trip.distanceKm != null && ` — ${trip.distanceKm.toFixed(1)} km`}
                {trip.distanceKm != null &&
                  trip.vehicleId?.avgConsumptionLPer100Km != null &&
                  (() => {
                    const f = estimateFuelRangeLiters(trip.distanceKm, trip.vehicleId.avgConsumptionLPer100Km);
                    return ` (${f.min.toFixed(1)}–${f.max.toFixed(1)} L)`;
                  })()}
              </span>
              <span className="font-medium text-teal-600">View replay</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
