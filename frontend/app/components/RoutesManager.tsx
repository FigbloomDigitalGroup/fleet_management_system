"use client";

import { useEffect, useState, FormEvent } from "react";
import { GoogleMap, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { apiRequest } from "../lib/api";
import { RouteRecord, VehicleRecord } from "../types/auth";
import { routeDistanceKm, estimateFuelRangeLiters } from "../lib/routeEstimate";
import { routeStatusBadge } from "../lib/routeStatus";

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 };
const DEFAULT_CONSUMPTION_L_PER_100KM = 12;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type LatLng = { lat: number; lng: number };

function frequencyLabel(frequency: "daily" | "weekly", daysOfWeek: number[]) {
  if (frequency === "daily") return "Every day";
  if (daysOfWeek.length === 0) return "Weekly";
  return [...daysOfWeek].sort().map((d) => DAY_LABELS[d]).join(", ");
}

export default function RoutesManager({ canManage = false }: { canManage?: boolean }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [draftSource, setDraftSource] = useState<"manual" | "ai">("manual");
  const [vehicleId, setVehicleId] = useState("");
  const [name, setName] = useState("");
  const [toleranceMeters, setToleranceMeters] = useState("300");
  const [speedLimitKph, setSpeedLimitKph] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    try {
      const [routeData, vehicleData] = await Promise.all([
        apiRequest<RouteRecord[]>("/api/routes"),
        apiRequest<VehicleRecord[]>("/api/vehicles"),
      ]);
      setRoutes(routeData);
      setVehicles(vehicleData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function applyDraft(draft: { waypoints?: LatLng[]; name?: string }) {
    if (Array.isArray(draft.waypoints) && draft.waypoints.length >= 2) {
      setWaypoints(draft.waypoints);
      setName(draft.name || "");
      setDraftSource("ai");
      setIsDrawing(true);
    }
  }

  // Picks up a route the AI assistant drew from a chat request made on a
  // *different* page (see AgentChatWidget) — handed off via sessionStorage
  // since navigating here mounts this component fresh, so a one-time read is
  // enough.
  useEffect(() => {
    if (!canManage) return;
    const draftRaw = sessionStorage.getItem("routeDraft");
    if (!draftRaw) return;
    sessionStorage.removeItem("routeDraft");
    try {
      applyDraft(JSON.parse(draftRaw));
    } catch {
      // malformed draft — ignore, user can just draw manually
    }
  }, [canManage]);

  // Picks up a route drawn while already sitting on this page — navigating
  // to the same URL is a no-op, so AgentChatWidget dispatches this event
  // directly instead, and we apply it live without a refresh.
  useEffect(() => {
    if (!canManage) return;
    function handleLiveDraft(e: Event) {
      applyDraft((e as CustomEvent).detail || {});
    }
    window.addEventListener("fleet:route-draft", handleLiveDraft);
    return () => window.removeEventListener("fleet:route-draft", handleLiveDraft);
  }, [canManage]);

  function startDrawing() {
    setIsDrawing(true);
    setWaypoints([]);
    setDraftSource("manual");
    setFormError(null);
  }

  function handleMapClick(e: google.maps.MapMouseEvent) {
    if (!canManage || !isDrawing || !e.latLng) return;
    setWaypoints((prev) => [...prev, { lat: e.latLng!.lat(), lng: e.latLng!.lng() }]);
  }

  function undoLastPoint() {
    setWaypoints((prev) => prev.slice(0, -1));
  }

  function clearDrawing() {
    setIsDrawing(false);
    setWaypoints([]);
    setDraftSource("manual");
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!vehicleId) {
      setFormError("Choose which vehicle this route is for.");
      return;
    }
    if (!name.trim()) {
      setFormError("Give this route a name.");
      return;
    }
    if (waypoints.length < 2) {
      setFormError("Click at least 2 points on the map to draw the path.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/api/routes", {
        method: "POST",
        body: JSON.stringify({
          vehicleId,
          name: name.trim(),
          waypoints,
          toleranceMeters: parseFloat(toleranceMeters) || 300,
          speedLimitKph: speedLimitKph ? parseFloat(speedLimitKph) : null,
          frequency,
          daysOfWeek: frequency === "weekly" ? daysOfWeek : [],
          source: draftSource,
        }),
      });
      setName("");
      setVehicleId("");
      setToleranceMeters("300");
      setSpeedLimitKph("");
      setFrequency("daily");
      setDaysOfWeek([]);
      clearDrawing();
      await load();
    } catch (err: any) {
      setFormError(err.message || "Failed to create route");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this route?")) return;
    setDeleteError(null);
    try {
      await apiRequest(`/api/routes/${id}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      setDeleteError(err.message);
    }
  }

  if (loading || !isLoaded) return <p className="text-sm text-gray-500">Loading routes…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const firstRouteWithPoints = routes.find((r) => r.waypoints.length > 0);
  const mapCenter = firstRouteWithPoints ? firstRouteWithPoints.waypoints[0] : defaultCenter;

  const drawnDistanceKm = waypoints.length > 1 ? routeDistanceKm(waypoints) : 0;
  const selectedVehicle = vehicles.find((v) => v._id === vehicleId);
  const drawnFuelEstimate =
    drawnDistanceKm > 0
      ? estimateFuelRangeLiters(drawnDistanceKm, selectedVehicle?.avgConsumptionLPer100Km ?? DEFAULT_CONSUMPTION_L_PER_100KM)
      : null;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {canManage && (
        <div className="lg:col-span-3 rounded-md border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs text-purple-700">
          <span className="font-semibold">NB:</span> If you're asking the AI assistant to create a route, use the
          exact spelling of the place name as it appears on the map — a misspelled name can't be matched to a real
          location.
        </div>
      )}

      {/* Map */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="h-[450px] w-full">
          <GoogleMap mapContainerStyle={containerStyle} center={mapCenter} zoom={12} onClick={handleMapClick}>
            {/* Existing active routes — purple if AI-drafted, orange if hand-drawn */}
            {routes
              .filter((r) => r.active && r.waypoints.length > 1)
              .map((r) => (
                <Polyline
                  key={r._id}
                  path={r.waypoints}
                  options={{
                    strokeColor: r.source === "ai" ? "#a855f7" : "#f97316",
                    strokeWeight: 4,
                    strokeOpacity: 0.8,
                  }}
                />
              ))}

            {/* Route being drawn — a plain line, no point markers. Same
                color rule: purple for an AI draft, orange while drawing by hand. */}
            {canManage && waypoints.length > 0 && (
              <Polyline
                path={waypoints}
                options={{
                  strokeColor: draftSource === "ai" ? "#a855f7" : "#f97316",
                  strokeWeight: 4,
                  strokeOpacity: 0.9,
                }}
              />
            )}
          </GoogleMap>
        </div>
        {canManage && (
          <p className="text-xs text-teal-600 text-center pt-3 border-t border-gray-100">
            {isDrawing
              ? "Click the map to add waypoints, in order, along the path this vehicle should follow."
              : 'Click "Draw a new route" to start placing waypoints.'}
          </p>
        )}
        <div className="flex items-center justify-center gap-4 pb-3 pt-1">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="h-0.5 w-4 rounded-full bg-orange-500" /> Drawn by you
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="h-0.5 w-4 rounded-full bg-purple-500" /> Drafted by AI
          </span>
        </div>
      </div>

      {/* Sidebar: list + create form */}
      <div className="space-y-4">
        {canManage && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Add a route</h3>

            {!isDrawing ? (
              <button
                type="button"
                onClick={startDrawing}
                className="w-full py-2 rounded-md text-sm font-medium text-white bg-teal-600 hover:bg-teal-700"
              >
                Draw a new route
              </button>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{waypoints.length} waypoint{waypoints.length === 1 ? "" : "s"} placed</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={undoLastPoint} className="text-teal-600 hover:underline">
                      Undo
                    </button>
                    <button type="button" onClick={clearDrawing} className="text-red-500 hover:underline">
                      Cancel
                    </button>
                  </div>
                </div>

                {drawnDistanceKm > 0 && (
                  <div className="rounded-md bg-purple-50 px-3 py-2 text-xs text-purple-700">
                    <p>Distance: {drawnDistanceKm.toFixed(1)} km</p>
                    <p>
                      Estimated fuel:{" "}
                      {drawnFuelEstimate
                        ? `${drawnFuelEstimate.min.toFixed(1)}–${drawnFuelEstimate.max.toFixed(1)} L`
                        : "—"}
                      {!selectedVehicle && " (default consumption rate — pick a vehicle for its own rate)"}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
                  >
                    <option value="">Select a vehicle…</option>
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.plateNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Route name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Depot to warehouse"
                    className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Deviation tolerance (meters)
                  </label>
                  <input
                    type="number"
                    value={toleranceMeters}
                    onChange={(e) => setToleranceMeters(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Speed limit (km/h) <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={speedLimitKph}
                    onChange={(e) => setSpeedLimitKph(e.target.value)}
                    placeholder="No override"
                    className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">How often it repeats</label>
                  <div className="flex gap-2">
                    {(["daily", "weekly"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={`flex-1 py-2 rounded-md text-xs font-medium border ${
                          frequency === f
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "bg-white border-gray-300 text-gray-600 hover:border-teal-400"
                        }`}
                      >
                        {f === "daily" ? "Every day" : "Specific days"}
                      </button>
                    ))}
                  </div>
                  {frequency === "weekly" && (
                    <div className="flex gap-1 mt-2">
                      {DAY_LABELS.map((label, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleDay(i)}
                          className={`flex-1 py-1.5 rounded-md text-[11px] font-medium border ${
                            daysOfWeek.includes(i)
                              ? "bg-teal-50 border-teal-400 text-teal-700"
                              : "bg-white border-gray-300 text-gray-500 hover:border-teal-400"
                          }`}
                        >
                          {label[0]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {formError && <p className="text-xs text-red-600">{formError}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                >
                  {isSubmitting ? "Saving…" : "Save route"}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          <p className="text-xs font-medium text-gray-500 p-4 pb-0">Existing routes</p>
          {deleteError && (
            <div className="mx-4 mt-3 flex items-start justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              <span>{deleteError}</span>
              <button onClick={() => setDeleteError(null)} className="shrink-0 font-medium hover:underline">
                Dismiss
              </button>
            </div>
          )}
          {routes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No routes created yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 mt-2">
              {routes.map((r) => {
                const vehicleIdStr = typeof r.vehicleId === "object" ? r.vehicleId._id : r.vehicleId;
                const vehicle = vehicles.find((v) => v._id === vehicleIdStr);
                const distanceKm = routeDistanceKm(r.waypoints);
                const fuelEstimate = estimateFuelRangeLiters(
                  distanceKm,
                  vehicle?.avgConsumptionLPer100Km ?? DEFAULT_CONSUMPTION_L_PER_100KM
                );

                return (
                  <li key={r._id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">
                        {r.name}
                        {!r.active && <span className="ml-2 text-[10px] text-gray-400 align-middle">inactive</span>}
                        <span className="ml-2 text-[10px] font-medium text-teal-600 align-middle">
                          {frequencyLabel(r.frequency ?? "daily", r.daysOfWeek ?? [])}
                        </span>
                        <span
                          className={`ml-2 text-[10px] font-medium align-middle ${
                            r.source === "ai" ? "text-purple-600" : "text-orange-600"
                          }`}
                        >
                          {r.source === "ai" ? "AI-drafted" : "Drawn by you"}
                        </span>
                        {r.active && (
                          <span
                            className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full border align-middle ${
                              routeStatusBadge(r).className
                            }`}
                          >
                            {routeStatusBadge(r).label}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {typeof r.vehicleId === "object" ? r.vehicleId.plateNumber : "Unknown vehicle"} ·{" "}
                        {distanceKm.toFixed(1)} km · {fuelEstimate.min.toFixed(1)}–{fuelEstimate.max.toFixed(1)} L ·
                        ±{r.toleranceMeters}m
                        {r.speedLimitKph ? ` · ${r.speedLimitKph} km/h limit` : ""}
                      </p>
                    </div>
                    {canManage && (
                      <button onClick={() => handleDelete(r._id)} className="text-xs text-red-500 hover:underline">
                        Delete
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
