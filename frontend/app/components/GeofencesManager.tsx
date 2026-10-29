"use client";

import { useEffect, useState, FormEvent } from "react";
import { GoogleMap, Circle, useJsApiLoader } from "@react-google-maps/api";
import { apiRequest } from "../lib/api";
import { usePulseColor } from "../lib/usePulseColor";
import { GeofenceRecord } from "../types/auth";

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 };

export default function GeofencesManager({ canManage = false }: { canManage?: boolean }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const zoneColor = usePulseColor();

  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [clickedCenter, setClickedCenter] = useState<{ lat: number; lng: number } | null>(null);
  // Where to centre the map when a draft arrives (AI zone, or a spot picked
  // on the Live Map) — unlike clickedCenter it doesn't follow later clicks.
  const [draftFocus, setDraftFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusM, setRadiusM] = useState("500");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiRequest<GeofenceRecord[]>("/api/geofences");
      setGeofences(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function applyDraft(draft: { name?: string; lat?: number; lng?: number; radiusMeters?: number }) {
    if (typeof draft.lat === "number" && typeof draft.lng === "number") {
      setClickedCenter({ lat: draft.lat, lng: draft.lng });
      setDraftFocus({ lat: draft.lat, lng: draft.lng });
      setName(draft.name || "");
      setRadiusM(String(draft.radiusMeters || 500));
    }
  }

  // Picks up a zone the AI assistant drafted from a chat request made on a
  // *different* page (see AgentChatWidget) — handed off via sessionStorage
  // since navigating here mounts this component fresh, so a one-time read is
  // enough.
  useEffect(() => {
    if (!canManage) return;
    const draftRaw = sessionStorage.getItem("geofenceDraft");
    if (!draftRaw) return;
    sessionStorage.removeItem("geofenceDraft");
    try {
      applyDraft(JSON.parse(draftRaw));
    } catch {
      // malformed draft — ignore, user can just click the map manually
    }
  }, [canManage]);

  // Picks up a zone drafted while already sitting on this page — navigating
  // to the same URL is a no-op, so AgentChatWidget dispatches this event
  // directly instead, and we apply it live without a refresh.
  useEffect(() => {
    if (!canManage) return;
    function handleLiveDraft(e: Event) {
      applyDraft((e as CustomEvent).detail || {});
    }
    window.addEventListener("fleet:geofence-draft", handleLiveDraft);
    return () => window.removeEventListener("fleet:geofence-draft", handleLiveDraft);
  }, [canManage]);

  function handleMapClick(e: google.maps.MapMouseEvent) {
    if (!canManage || !e.latLng) return;
    setClickedCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!clickedCenter) {
      setFormError("Click on the map to set the center point first.");
      return;
    }
    if (!name.trim()) {
      setFormError("Give this zone a name.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/api/geofences", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type: "circle",
          centerLat: clickedCenter.lat,
          centerLng: clickedCenter.lng,
          radiusM: parseFloat(radiusM),
        }),
      });
      setName("");
      setClickedCenter(null);
      setRadiusM("500");
      await load();
    } catch (err: any) {
      setFormError(err.message || "Failed to create geofence");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this geofence?")) return;
    setDeleteError(null);
    try {
      await apiRequest(`/api/geofences/${id}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      setDeleteError(err.message);
    }
  }

  if (loading || !isLoaded) return <p className="text-sm text-gray-500">Loading geofences…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const mapCenter =
    draftFocus ??
    (geofences.length > 0 && geofences[0].centerLat
      ? { lat: geofences[0].centerLat, lng: geofences[0].centerLng! }
      : defaultCenter);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {canManage && (
        <div className="lg:col-span-3 flex items-center gap-3 rounded border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs text-purple-700">
          <img src="/danger.png" alt="Warning" className="h-6 w-auto shrink-0 animate-bounce" />
          <p>
            <span className="font-semibold">NB:</span> If you're asking the AI assistant to create a geofence, use the
            exact spelling of the place name as it appears on the map — a misspelled name can't be matched to a real
            location.
          </p>
        </div>
      )}

      {/* Map */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="h-[450px] w-full">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={12}
            onClick={handleMapClick}
          >
            {/* Existing geofences */}
            {geofences.map(
              (g) =>
                g.type === "circle" &&
                g.centerLat &&
                g.centerLng && (
                  <Circle
                    key={g._id}
                    center={{ lat: g.centerLat, lng: g.centerLng }}
                    radius={g.radiusM}
                    options={{
                      fillColor: zoneColor,
                      fillOpacity: 0.15,
                      strokeColor: zoneColor,
                      strokeWeight: 2,
                    }}
                  />
                )
            )}

            {/* Preview of the zone being created */}
            {canManage && clickedCenter && (
              <Circle
                center={clickedCenter}
                radius={parseFloat(radiusM) || 0}
                options={{
                  fillColor: "#ffa049",
                  fillOpacity: 0.15,
                  strokeColor: "#ffa049",
                  strokeWeight: 2,
                  strokeOpacity: 0.6,
                }}
              />
            )}
          </GoogleMap>
        </div>
        {canManage && (
          <p className="text-xs text-teal-600 text-center py-3 border-t border-gray-100">
            Click anywhere on the map to set a new zone's center point.
          </p>
        )}
      </div>

      {/* Sidebar: list + create form */}
      <div className="space-y-4">
        {canManage && (
          <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Add a zone</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zone name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Main Depot"
                  className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Radius (meters)</label>
                <input
                  type="number"
                  value={radiusM}
                  onChange={(e) => setRadiusM(e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-400"
                />
              </div>
              <p className="text-xs text-teal-600">
                {clickedCenter
                  ? `Center set: ${clickedCenter.lat.toFixed(4)}, ${clickedCenter.lng.toFixed(4)}`
                  : "Click the map to set a center point."}
              </p>

              {formError && <p className="text-xs text-red-600">{formError}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
              >
                {isSubmitting ? "Creating…" : "Create zone"}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
          <p className="text-xs font-medium text-gray-500 p-4 pb-0">Existing zones</p>
          {deleteError && (
            <div className="mx-4 mt-3 flex items-start justify-between gap-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
              <span>{deleteError}</span>
              <button onClick={() => setDeleteError(null)} className="shrink-0 font-medium hover:underline">
                Dismiss
              </button>
            </div>
          )}
          {geofences.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No zones created yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 mt-2">
              {geofences.map((g) => (
                <li key={g._id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{g.name}</p>
                    <p className="text-xs text-gray-400">
                      {g.type === "circle" ? `${g.radiusM}m radius` : "custom shape"}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(g._id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}