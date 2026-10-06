"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, OverlayView, Circle, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { IoCarSportSharp } from "react-icons/io5";
import { ImLocation2 } from "react-icons/im";
import { FaSearch } from "react-icons/fa";
import { FiPlus, FiMinus, FiCrosshair } from "react-icons/fi";
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

// Toggle-pill styling shared by the Zones/Routes/Trails layer controls —
// filled when the layer is visible, muted text when hidden, same idea as a
// real mapping product's layer switcher.
const PILL_ACTIVE_STYLES: Record<"teal" | "blue" | "purple", string> = {
  teal: "bg-teal-50 text-teal-700",
  blue: "bg-blue-50 text-blue-700",
  purple: "bg-purple-50 text-purple-700",
};
function layerPillClass(active: boolean, color: "teal" | "blue" | "purple") {
  return `rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
    active ? PILL_ACTIVE_STYLES[color] : "text-gray-400 hover:text-gray-600"
  }`;
}

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

  // Recenters/fits the map to whatever vehicles currently have a GPS fix —
  // the floating button equivalent of a real mapping product's "locate me".
  function handleRecenter() {
    const map = mapRef.current;
    if (!map) return;

    if (visibleVehicles.length === 0) {
      map.panTo(defaultCenter);
      map.setZoom(12);
      return;
    }
    if (visibleVehicles.length === 1) {
      map.panTo({
        lat: visibleVehicles[0].lastLocation!.latitude,
        lng: visibleVehicles[0].lastLocation!.longitude,
      });
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    visibleVehicles.forEach((v) =>
      bounds.extend({ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude })
    );
    map.fitBounds(bounds);
  }

  function handleZoom(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom((map.getZoom() || 12) + delta);
  }

  if (loading || !isLoaded) return <FullPageLoading label="Loading map" />;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Map — takes the big central space */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden mb-3">
          <div className="relative h-[calc(100vh-220px)] min-h-[560px] w-full">
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
              options={{
                disableDefaultUI: true,
                mapTypeControl: false,
                zoomControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                rotateControl: false,
                scaleControl: false,
                clickableIcons: false,
                draggableCursor: pickMode ? "crosshair" : undefined,
              }}
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

            {/* Floating top bar — search on the left, layer toggles on the
                right, both overlaying the map instead of sitting in a
                separate bordered strip above it. */}
            <div className="absolute inset-x-3 top-3 z-10 flex flex-col gap-2 sm:flex-row sm:items-start">
              <form
                onSubmit={handleSearch}
                className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-lg ring-1 ring-black/5"
              >
                <FaSearch className="shrink-0 text-gray-400" size={13} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by plate number or type (car, van, truck)…"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                {searchQuery && (
                  <button type="submit" className="shrink-0 text-xs font-medium text-teal-600 hover:text-teal-700">
                    Search
                  </button>
                )}
              </form>

              {(geofences.length > 0 || routes.length > 0) && (
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1.5 shadow-lg ring-1 ring-black/5">
                  {geofences.length > 0 && (
                    <button onClick={() => setShowGeofences((s) => !s)} className={layerPillClass(showGeofences, "teal")}>
                      Zones
                    </button>
                  )}
                  {routes.length > 0 && (
                    <button onClick={() => setShowRoutes((s) => !s)} className={layerPillClass(showRoutes, "blue")}>
                      Routes
                    </button>
                  )}
                  <button onClick={() => setShowTrails((s) => !s)} className={layerPillClass(showTrails, "purple")}>
                    Trails
                  </button>
                </div>
              )}
            </div>

            {searchMessage && (
              <div className="absolute left-3 top-16 z-10 max-w-sm rounded-lg bg-white px-3 py-2 text-xs text-gray-600 shadow-lg ring-1 ring-black/5">
                {searchMessage}
              </div>
            )}

            {/* Floating controls — recenter + zoom, replacing Google's
                default UI (disabled above) with ones that match the rest of
                the app's styling. Anchored top-right, below the search/layer
                bar, rather than bottom-right — mapOverlay (e.g. the admin
                page's "set starting point" sheet) can occupy the full bottom
                edge, which would otherwise cover them. */}
            <div className="absolute right-3 top-16 z-10 flex flex-col gap-2">
              <button
                onClick={handleRecenter}
                title="Recenter on fleet"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg ring-1 ring-black/5 hover:text-teal-600"
              >
                <FiCrosshair size={16} />
              </button>
              <div className="flex flex-col overflow-hidden rounded-full bg-white shadow-lg ring-1 ring-black/5">
                <button
                  onClick={() => handleZoom(1)}
                  title="Zoom in"
                  className="flex h-9 w-9 items-center justify-center border-b border-gray-100 text-gray-600 hover:text-teal-600"
                >
                  <FiPlus size={16} />
                </button>
                <button
                  onClick={() => handleZoom(-1)}
                  title="Zoom out"
                  className="flex h-9 w-9 items-center justify-center text-gray-600 hover:text-teal-600"
                >
                  <FiMinus size={16} />
                </button>
              </div>
            </div>

            {mapOverlay}
          </div>

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




