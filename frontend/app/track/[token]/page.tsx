"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { FiCheck, FiMapPin, FiTruck, FiXCircle } from "react-icons/fi";
import { API_URL, errorMessage } from "../../lib/api";
import { formatWindow } from "../../lib/jobStatus";
import { PublicTracking } from "../../types/auth";
import BrandIcon from "../../components/BrandIcon";

const POLL_MS = 15000;
const containerStyle = { width: "100%", height: "100%" };

const STEPS = [
  { key: "assigned", label: "Scheduled" },
  { key: "started", label: "On the way" },
  { key: "arrived", label: "Arrived" },
  { key: "completed", label: "Delivered" },
] as const;

function stepIndex(status: PublicTracking["status"]) {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function headline(t: PublicTracking) {
  switch (t.status) {
    case "assigned":
      return "Your delivery is scheduled";
    case "started":
      return t.etaMinutes != null ? `Arriving in about ${t.etaMinutes} min` : "Your driver is on the way";
    case "arrived":
      return "Your driver has arrived";
    case "completed":
      return "Delivered";
    case "failed":
      return "We couldn't complete this delivery";
    case "cancelled":
      return "This delivery was cancelled";
  }
}

// Public, no-login page the customer opens from the link the dispatcher
// shares. Lives outside the portals (no DashboardShell/ProtectedRoute) and
// fetches without any stored session, so it works for anyone with the link.
export default function PublicTrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicTracking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/public/track/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return; // A bad link won't fix itself — stop polling.
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Couldn't load tracking right now");
        setData(body);
        setError(null);
        // Finished jobs don't change any more, so there's nothing to poll for.
        if (["completed", "failed", "cancelled"].includes(body.status)) return;
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Couldn't load tracking right now"));
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) timer = setTimeout(load, POLL_MS);
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token]);

  // Keep both the destination and the driver in view as the driver moves.
  const driverKey = data?.driverLocation ? `${data.driverLocation.latitude},${data.driverLocation.longitude}` : "";
  useEffect(() => {
    if (!map || !data) return;
    const dest = { lat: data.destination.latitude, lng: data.destination.longitude };
    if (!data.driverLocation) {
      map.panTo(dest);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(dest);
    bounds.extend({ lat: data.driverLocation.latitude, lng: data.driverLocation.longitude });
    map.fitBounds(bounds, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, driverKey, data?.destination.latitude, data?.destination.longitude]);

  const finishedBad = data?.status === "failed" || data?.status === "cancelled";
  const current = data ? stepIndex(data.status) : 0;

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="flex items-center gap-2 bg-teal-950 px-4 py-3 text-white">
        <BrandIcon variant="light" className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold">{data?.companyName ?? "FIGBLOOM FLEET"}</span>
        <span className="ml-auto text-[10px] text-white/70">Live delivery tracking</span>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        {loading && !data && !notFound && <div className="skeleton-shimmer h-40 rounded-lg" />}

        {notFound && (
          <div className="rounded-lg bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
            <FiXCircle className="mx-auto text-red-500" size={32} />
            <h1 className="mt-3 text-base font-bold text-blue-950">This tracking link isn&apos;t valid</h1>
            <p className="mt-1 text-sm text-gray-500">
              Check you copied the whole link, or ask the sender for a new one.
            </p>
          </div>
        )}

        {error && !notFound && (
          <p className="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
            {error}
            {data ? " — showing the last update." : ""}
          </p>
        )}

        {data && (
          <>
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600">{data.title}</p>
              <h1 className={`mt-1 text-xl font-bold ${finishedBad ? "text-red-600" : "text-blue-950"}`}>{headline(data)}</h1>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600">
                <FiMapPin className="mt-0.5 shrink-0 text-teal-600" />
                {data.address}
              </p>

              {data.status === "started" && data.distanceRemainingKm != null && (
                <p className="mt-2 text-sm text-gray-700">
                  About <span className="font-bold">{data.distanceRemainingKm} km</span> away
                </p>
              )}
              {data.status === "assigned" && (data.windowStart || data.windowEnd) && (
                <p className="mt-2 text-sm text-gray-700">
                  Expected window: <span className="font-bold">{formatWindow(data.windowStart, data.windowEnd)}</span>
                </p>
              )}
              {data.status === "completed" && data.completedAt && (
                <p className="mt-2 text-sm text-gray-700">
                  Completed {new Date(data.completedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}
              {data.status === "failed" && data.failureReason && (
                <p className="mt-2 rounded bg-red-50 p-3 text-sm text-red-700">{data.failureReason}</p>
              )}

              {!finishedBad && (
                <ol className="mt-5 flex items-start">
                  {STEPS.map((step, i) => {
                    const done = i <= current;
                    return (
                      <li key={step.key} className="flex flex-1 flex-col items-center text-center">
                        <div className="flex w-full items-center">
                          <span className={`h-0.5 flex-1 ${i === 0 ? "invisible" : done ? "bg-teal-600" : "bg-gray-200"}`} />
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              done ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {i < current || data.status === "completed" ? <FiCheck size={14} /> : i + 1}
                          </span>
                          <span
                            className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? "invisible" : i < current ? "bg-teal-600" : "bg-gray-200"}`}
                          />
                        </div>
                        <span className={`mt-1.5 text-[11px] ${done ? "font-medium text-blue-950" : "text-gray-400"}`}>{step.label}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {(data.driverFirstName || data.plateNumber) && (
              <div className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                  <FiTruck size={18} />
                </span>
                <div>
                  <p className="text-sm font-medium text-blue-950">{data.driverFirstName ?? "Your driver"}</p>
                  {data.plateNumber && <p className="text-xs text-gray-500">Vehicle {data.plateNumber}</p>}
                </div>
              </div>
            )}

            {isLoaded && (
              <div className="h-72 overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 sm:h-96">
                <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={{ lat: data.destination.latitude, lng: data.destination.longitude }}
                  zoom={14}
                  onLoad={setMap}
                  options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                >
                  <OverlayView
                    position={{ lat: data.destination.latitude, lng: data.destination.longitude }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  >
                    <div style={{ transform: "translate(-50%, -100%)" }} className="flex flex-col items-center">
                      <span className="mb-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-blue-950 shadow">Destination</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-orange-500 shadow">
                        <FiMapPin size={13} color="white" />
                      </span>
                    </div>
                  </OverlayView>
                  {data.driverLocation && (
                    <OverlayView
                      position={{ lat: data.driverLocation.latitude, lng: data.driverLocation.longitude }}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    >
                      <div style={{ transform: "translate(-50%, -50%)" }} className="relative h-8 w-8">
                        <span className="absolute inset-0 animate-ping rounded-full bg-teal-500 opacity-40" />
                        <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-teal-600 shadow">
                          <FiTruck size={14} color="white" />
                        </span>
                      </div>
                    </OverlayView>
                  )}
                </GoogleMap>
              </div>
            )}

            <p className="text-center text-[11px] text-gray-400">
              {["completed", "failed", "cancelled"].includes(data.status)
                ? "This delivery is finished."
                : "Updates automatically every 15 seconds."}{" "}
              Powered by FIGBLOOM FLEET
            </p>
          </>
        )}
      </main>
    </div>
  );
}
