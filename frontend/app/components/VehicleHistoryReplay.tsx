"use client";

import { FormEvent, useEffect, useState } from "react";
import { GoogleMap, OverlayView, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { FaCircle, FaFlagCheckered } from "react-icons/fa";
import { apiRequest, errorMessage } from "../lib/api";
import { formatDateTime, formatMinutes, formatTime, toDateTimeLocal } from "../lib/dateKeys";
import { HistoryStop, LocationHistory } from "../types/auth";

const containerStyle = { width: "100%", height: "100%" };
const MAX_DAYS = 31;
// Plotting thousands of fake-GPS dots would bog the map down — the count
// and the first few are what matter.
const MAX_MOCK_MARKERS = 200;

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-bold text-blue-950">{value}</p>
    </div>
  );
}

// Replay any date & time range for one vehicle (not just a single trip):
// the path, where it stopped and for how long, and any fake-GPS points.
export default function VehicleHistoryReplay({ vehicleId }: { vehicleId: string }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDateTimeLocal(d);
  });
  const [to, setTo] = useState(() => toDateTimeLocal(new Date()));
  const [history, setHistory] = useState<LocationHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<HistoryStop | null>(null);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  async function load(e?: FormEvent) {
    e?.preventDefault();
    const start = new Date(from);
    const end = new Date(to);
    if (!(start < end)) {
      setError("The start has to be before the end.");
      return;
    }
    if (end.getTime() - start.getTime() > MAX_DAYS * 86400000) {
      setError(`Pick a range of ${MAX_DAYS} days or less.`);
      return;
    }
    setLoading(true);
    setError(null);
    setSelectedStop(null);
    try {
      const data = await apiRequest<LocationHistory>(
        `/api/tracking/history?vehicleId=${vehicleId}&from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`
      );
      setHistory(data);
      setScrubIndex(Math.max(data.points.length - 1, 0));
    } catch (err) {
      setError(errorMessage(err, "Failed to load history"));
    } finally {
      setLoading(false);
    }
  }

  // Load today's movement straight away so the section isn't empty.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  // Fit the map to the loaded path.
  useEffect(() => {
    if (!map || !history || history.points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    history.points.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    map.fitBounds(bounds, 40);
  }, [map, history]);

  const points = history?.points ?? [];
  const path = points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  const mocked = points.filter((p) => p.isMocked);
  const current = points[scrubIndex];

  return (
    <div>
      <form onSubmit={load} className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-teal-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-teal-600"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Show history"}
        </button>
        <span className="text-[11px] text-gray-400">Up to {MAX_DAYS} days at a time</span>
      </form>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {history && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Summary label="Distance" value={`${history.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`} />
            <Summary label="Moving" value={formatMinutes(history.movingMinutes)} />
            <Summary label="Idle" value={formatMinutes(history.idleMinutes)} />
            <Summary label="Stops" value={String(history.stops.length)} />
            <Summary label="GPS points" value={points.length.toLocaleString()} />
          </div>
          {history.truncated && (
            <p className="mb-2 text-xs text-orange-600">
              Showing the first {points.length.toLocaleString()} points only — pick a shorter range to see all of it.
            </p>
          )}
          {mocked.length > 0 && (
            <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {mocked.length} point{mocked.length === 1 ? "" : "s"} in this range came from a fake-GPS app (red dots on the map).
            </p>
          )}
        </>
      )}

      {history && points.length === 0 && !loading && (
        <div className="rounded bg-gray-50 p-8 text-center text-sm text-gray-400">No location recorded in this range.</div>
      )}

      {history && points.length > 0 && isLoaded && (
        <>
          <div className="h-[420px] w-full overflow-hidden rounded ring-1 ring-black/5">
            <GoogleMap mapContainerStyle={containerStyle} center={path[0]} zoom={13} onLoad={setMap}>
              <Polyline path={path} options={{ strokeColor: "#0e4f27", strokeWeight: 4, strokeOpacity: 0.8 }} />

              {mocked.slice(0, MAX_MOCK_MARKERS).map((p) => (
                <OverlayView key={`m-${p.recordedAt}`} position={{ lat: p.latitude, lng: p.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <div
                    style={{ transform: "translate(-50%, -50%)" }}
                    className="h-2.5 w-2.5 rounded-full border border-white bg-red-600"
                    title={`Fake GPS · ${formatDateTime(p.recordedAt)}`}
                  />
                </OverlayView>
              ))}

              {history.stops.map((s, i) => (
                <OverlayView key={`s-${s.startedAt}`} position={{ lat: s.latitude, lng: s.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <button
                    type="button"
                    onClick={() => setSelectedStop(s)}
                    title={`Stop ${i + 1}: ${formatMinutes(s.durationMinutes)} (${formatTime(s.startedAt)}–${formatTime(s.endedAt)})`}
                    style={{ transform: "translate(-50%, -50%)" }}
                    className={`flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-bold text-white shadow ${
                      selectedStop === s ? "bg-orange-600" : "bg-orange-500"
                    }`}
                  >
                    P
                  </button>
                </OverlayView>
              ))}

              <OverlayView position={path[0]} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div style={{ transform: "translate(-50%, -100%)" }}>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-teal-500 shadow">
                    <FaCircle size={8} color="white" />
                  </div>
                </div>
              </OverlayView>
              <OverlayView position={path[path.length - 1]} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div style={{ transform: "translate(-50%, -100%)" }}>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-700 shadow">
                    <FaFlagCheckered size={10} color="white" />
                  </div>
                </div>
              </OverlayView>

              {current && (
                <OverlayView position={{ lat: current.latitude, lng: current.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <div style={{ transform: "translate(-50%, -50%)" }} className="h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow" />
                </OverlayView>
              )}
            </GoogleMap>
          </div>

          <div className="mt-3 rounded bg-gray-50 p-3">
            <input
              type="range"
              min={0}
              max={points.length - 1}
              value={scrubIndex}
              onChange={(e) => setScrubIndex(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
            {current && (
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>{formatDateTime(current.recordedAt)}</span>
                <span>
                  {current.speedKph != null ? `${Math.round(current.speedKph)} km/h` : "—"}
                  {current.isMocked && <span className="ml-2 font-medium text-red-600">Fake GPS</span>}
                </span>
                <span>
                  Point {scrubIndex + 1} of {points.length}
                </span>
              </div>
            )}
          </div>

          {selectedStop && (
            <p className="mt-3 rounded border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
              Stopped for <span className="font-bold">{formatMinutes(selectedStop.durationMinutes)}</span> —{" "}
              {formatDateTime(selectedStop.startedAt)} to {formatTime(selectedStop.endedAt)}
            </p>
          )}

          {history.stops.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-teal-600">All stops ({history.stops.length})</summary>
              <ul className="mt-2 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded border border-gray-100 text-xs">
                {history.stops.map((s, i) => (
                  <li key={s.startedAt}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStop(s);
                        map?.panTo({ lat: s.latitude, lng: s.longitude });
                      }}
                      className="flex w-full justify-between px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span className="text-gray-700">
                        {i + 1}. {formatDateTime(s.startedAt)} – {formatTime(s.endedAt)}
                      </span>
                      <span className="font-medium text-orange-600">{formatMinutes(s.durationMinutes)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
