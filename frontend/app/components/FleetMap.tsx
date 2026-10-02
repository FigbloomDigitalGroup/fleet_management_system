"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, OverlayView, Circle, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { IoCarSportSharp } from "react-icons/io5";
import { ImLocation2 } from "react-icons/im";
import { FaSearch } from "react-icons/fa";
import { apiRequest } from "../lib/api";
import { usePulseColor } from "../lib/usePulseColor";
import { isOutsideGeofences } from "../lib/geofence";
import StatCard from "./StatCard";
import CircleStat from "./CircleStat";
import FullPageLoading from "./FullPageLoading";
import { GeofenceRecord, RouteRecord } from "../types/auth";

interface LiveVehicle {
  vehicleId: string;
  plateNumber: string;
  status: string;
  vehicleType?: string;
  lastLocation: { latitude: number; longitude: number; recordedAt: string } | null;
  recentTrail?: { latitude: number; longitude: number; recordedAt: string }[];
}

const statusColor: Record<string, string> = {
  active: "#2dd4bf",
  idle: "#fb923c",
  offline: "#9ca3af",
  maintenance: "#f87171",
};

const LEGEND_ITEMS = [
  { label: "Active — currently moving", color: "#2dd4bf" },
  { label: "Idle — stationary, engine on", color: "#fb923c" },
  { label: "Offline — no recent signal", color: "#9ca3af" },
  { label: "Maintenance — out of service", color: "#f87171" },
];

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 };

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function VehicleMarker({
  vehicle,
  outOfGeofence,
  onClick,
}: {
  vehicle: LiveVehicle;
  outOfGeofence: boolean;
  onClick: () => void;
}) {
  const color = statusColor[vehicle.status] || "#9ca3af";

  return (
    <div
      className="flex flex-col items-center cursor-pointer"
      style={{ transform: "translate(-50%, -100%)" }}
      onClick={onClick}
    >
      <div
        className="mb-1 px-2 py-1 rounded-md shadow-sm bg-white border text-xs whitespace-nowrap"
        style={{ borderColor: outOfGeofence ? "#ef4444" : color }}
      >
        <span className="font-semibold text-gray-900">{vehicle.plateNumber}</span>
        <span className="text-gray-400"> · </span>
        <span style={{ color }}>{vehicle.status}</span>
        {vehicle.lastLocation && (
          <>
            <span className="text-gray-400"> · </span>
            <span className="text-gray-500">{timeAgo(vehicle.lastLocation.recordedAt)}</span>
          </>
        )}
        {outOfGeofence && (
          <>
            <span className="text-gray-400"> · </span>
            <span className="text-red-500 font-medium">outside zone</span>
          </>
        )}
      </div>

      <div className="relative w-8 h-8">
        {outOfGeofence && (
          <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping" />
        )}
        <div
          className="relative w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow hover:scale-110 transition-transform"
          style={{ background: outOfGeofence ? "#ef4444" : color }}
        >
          <IoCarSportSharp size={14} color="white" />
        </div>
      </div>
    </div>
  );
}

function StartPointMarker({ variant }: { variant: "saved" | "preview" }) {
  const color = variant === "saved" ? "#0d9488" : "#f97316";

  return (
    <div className="flex flex-col items-center" style={{ transform: "translate(-50%, -100%)" }}>
      <div
        className="mb-1 px-2 py-1 rounded-md shadow-sm bg-white border text-xs font-semibold whitespace-nowrap"
        style={{ borderColor: color, color }}
      >
        {variant === "saved" ? "Start point" : "New start point"}
      </div>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow"
        style={{ background: color }}
      >
        <ImLocation2 size={12} color="white" />
      </div>
    </div>
  );
}

interface LatLng {
  lat: number;
  lng: number;
}

export default function FleetMap({
  basePath = "/admin/vehicles",
  pickMode = false,
  savedStartPoint = null,
  pickedStartPoint = null,
  onPickStartPoint,
  mapOverlay,
}: {
  basePath?: string;
  pickMode?: boolean;
  savedStartPoint?: LatLng | null;
  pickedStartPoint?: LatLng | null;
  onPickStartPoint?: (point: LatLng) => void;
  mapOverlay?: ReactNode;
}) {
  const router = useRouter();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });
  const zoneColor = usePulseColor();

  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showTrails, setShowTrails] = useState(true);

  const mapRef = useRef<google.maps.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  async function load() {
    try {
      const [vehicleData, geofenceData, routeData] = await Promise.all([
        apiRequest<LiveVehicle[]>("/api/tracking/live"),
        apiRequest<GeofenceRecord[]>("/api/geofences"),
        apiRequest<RouteRecord[]>("/api/routes"),
      ]);
      setVehicles(vehicleData);
      setGeofences(geofenceData);
      setRoutes(routeData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const withLocation = vehicles.filter((v) => v.lastLocation);
  const visibleVehicles = withLocation;
  const center =
    visibleVehicles.length > 0
      ? { lat: visibleVehicles[0].lastLocation!.latitude, lng: visibleVehicles[0].lastLocation!.longitude }
      : defaultCenter;

  const counts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
  };

  const reportingPct = counts.total ? Math.round((withLocation.length / counts.total) * 100) : 0;

  const mostRecent = withLocation.length
    ? withLocation.reduce((latest, v) =>
        new Date(v.lastLocation!.recordedAt) > new Date(latest.lastLocation!.recordedAt) ? v : latest
      )
    : null;

  // Search by plate number or vehicle type (car/van/truck) — zooms the map to
  // whatever matches, without changing anything about how vehicles are
  // fetched, filtered, or rendered above.
  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchMessage(null);
      return;
    }

    const matches = vehicles.filter(
      (v) =>
        v.plateNumber.toLowerCase().includes(query) ||
        (v.vehicleType && v.vehicleType.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
      setSearchMessage(`No vehicle found matching "${searchQuery.trim()}".`);
      return;
    }

    const matchesOnMap = matches.filter((v) => v.lastLocation);

    if (matchesOnMap.length === 0) {
      setSearchMessage(
        matches.length === 1
          ? `${matches[0].plateNumber} exists but isn't showing on the map yet — no GPS location received.`
          : `Found ${matches.length} matching vehicles, but none are showing on the map yet — no GPS location received.`
      );
      return;
    }

    const map = mapRef.current;
    if (map) {
      if (matchesOnMap.length === 1) {
        map.panTo({ lat: matchesOnMap[0].lastLocation!.latitude, lng: matchesOnMap[0].lastLocation!.longitude });
        map.setZoom(16);
      } else {
        const bounds = new google.maps.LatLngBounds();
        matchesOnMap.forEach((v) => bounds.extend({ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }));
        map.fitBounds(bounds);
      }
    }

    setSearchMessage(
      matchesOnMap.length === 1
        ? `Zoomed to ${matchesOnMap[0].plateNumber}.`
        : `Found ${matchesOnMap.length} matching vehicles on the map.`
    );
  }

  if (loading || !isLoaded) return <FullPageLoading label="Loading map" />;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Map — takes the big central space */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden mb-3">
          {/* Vehicle search — zooms the map to a match by plate number or
              vehicle type (car/van/truck); purely additive, doesn't touch
              how vehicles are loaded or rendered below. */}
          <div className="border-b border-gray-100 p-3">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by plate number or type (car, van, truck)…"
                  className="w-full pl-9 pr-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
              <button
                type="submit"
                className="shrink-0 rounded-md bg-teal-600 px-4 py-2 text-xs font-medium text-white hover:bg-teal-700"
              >
                Search
              </button>
            </form>
            {searchMessage && <p className="mt-2 text-xs text-gray-500">{searchMessage}</p>}
          </div>

          <div className="relative h-[calc(100vh-260px)] min-h-[520px] w-full">
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={12}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              onClick={
                pickMode && onPickStartPoint
                  ? (e) => {
                      if (e.latLng) onPickStartPoint({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                    }
                  : undefined
              }
              options={pickMode ? { draggableCursor: "crosshair" } : undefined}
            >
              {/* Geofence zones */}
              {showGeofences &&
                geofences.map(
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
                          fillOpacity: 0.12,
                          strokeColor: zoneColor,
                          strokeWeight: 1.5,
                          clickable: false,
                        }}
                      />
                    )
                )}

              {/* Planned routes — the path a vehicle is expected to follow */}
              {showRoutes &&
                routes
                  .filter((r) => r.active && r.waypoints.length > 1)
                  .map((r) => (
                    <Polyline
                      key={r._id}
                      path={r.waypoints}
                      options={{
                        strokeColor: "#3b82f6",
                        strokeWeight: 3,
                        strokeOpacity: 0.7,
                        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "12px" }],
                      }}
                    />
                  ))}

              {/* Live trail — where a vehicle has actually been recently, distinct from the planned route above */}
              {showTrails &&
                vehicles
                  .filter((v) => v.recentTrail && v.recentTrail.length > 1)
                  .map((v) => (
                    <Polyline
                      key={`trail-${v.vehicleId}`}
                      path={v.recentTrail!.map((p) => ({ lat: p.latitude, lng: p.longitude }))}
                      options={{ strokeColor: "#a855f7", strokeWeight: 3, strokeOpacity: 0.85 }}
                    />
                  ))}

              {/* Vehicles — plotted as soon as they have a GPS fix, independent of geofences */}
              {visibleVehicles.map((v) => (
                <OverlayView
                  key={v.vehicleId}
                  position={{ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <VehicleMarker
                    vehicle={v}
                    outOfGeofence={isOutsideGeofences(
                      v.lastLocation!.latitude,
                      v.lastLocation!.longitude,
                      geofences
                    )}
                    onClick={() => router.push(`${basePath}/${v.vehicleId}`)}
                  />
                </OverlayView>
              ))}

              {/* Driver daily starting point */}
              {savedStartPoint && (
                <OverlayView position={savedStartPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <StartPointMarker variant="saved" />
                </OverlayView>
              )}
              {pickedStartPoint && (
                <OverlayView position={pickedStartPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <StartPointMarker variant="preview" />
                </OverlayView>
              )}
            </GoogleMap>

            {mapOverlay}
          </div>

          {/* Geofence / route / trail toggles */}
          {(geofences.length > 0 || routes.length > 0) && (
            <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-500">
                {geofences.length > 0 && `${geofences.length} geofence${geofences.length !== 1 ? "s" : ""}`}
                {geofences.length > 0 && routes.length > 0 && " · "}
                {routes.length > 0 && `${routes.length} route${routes.length !== 1 ? "s" : ""}`}
              </span>
              <div className="flex items-center gap-3">
                {geofences.length > 0 && (
                  <button onClick={() => setShowGeofences((s) => !s)} className="text-xs text-teal-600 hover:underline">
                    {showGeofences ? "Hide zones" : "Show zones"}
                  </button>
                )}
                {routes.length > 0 && (
                  <button onClick={() => setShowRoutes((s) => !s)} className="text-xs text-blue-600 hover:underline">
                    {showRoutes ? "Hide routes" : "Show routes"}
                  </button>
                )}
                <button onClick={() => setShowTrails((s) => !s)} className="text-xs text-purple-600 hover:underline">
                  {showTrails ? "Hide trails" : "Show trails"}
                </button>
              </div>
            </div>
          )}

          {withLocation.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No vehicle location data yet — vehicles will appear once GPS pings start coming in.
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4 mb-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Marker colors</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: item.color }} />
                <span className="text-xs text-gray-600">{item.label}</span>
              </div>
            ))}
            {geofences.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-teal-400 bg-teal-400/20" />
                <span className="text-xs text-gray-600">Geofence zone</span>
              </div>
            )}
            {geofences.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="relative w-3 h-3">
                  <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative block w-3 h-3 rounded-full bg-red-500" />
                </span>
                <span className="text-xs text-gray-600">Vehicle outside geofence</span>
              </div>
            )}
            {savedStartPoint && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: "#0d9488" }} />
                <span className="text-xs text-gray-600">Driver starting point</span>
              </div>
            )}
            {routes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-4" style={{ background: "#3b82f6" }} />
                <span className="text-xs text-gray-600">Planned route</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-4" style={{ background: "#a855f7" }} />
              <span className="text-xs text-gray-600">Recent movement (last 30 min)</span>
            </div>
          </div>
        </div>

        {/* Reporting % + freshness — below the map */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CircleStat
            percentage={reportingPct}
            label="Vehicles reporting location"
            color="#2dd4bf"
            description="Share of the fleet with a live GPS fix right now"
          />
          <StatCard
            label="Most recent update"
            value={mostRecent ? timeAgo(mostRecent.lastLocation!.recordedAt) : "—"}
            accent="green"
            description={mostRecent ? `From ${mostRecent.plateNumber}` : "No GPS pings received yet"}
            background="bg-teal-300"
            light
          />
        </div>
      </div>

      {/* Stat cards — stacked in a column on the right */}
      <div className="flex flex-col gap-4 lg:w-72 xl:w-80 lg:flex-shrink-0">
        <StatCard label="Total vehicles" value={counts.total} accent="green" />
        <StatCard label="Active" value={counts.active} accent="green" />
        <StatCard label="Idle" value={counts.idle} accent="orange" />
        <StatCard label="Offline" value={counts.offline} accent="orange" />
      </div>
    </div>
  );
}




