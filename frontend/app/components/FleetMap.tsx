"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleMap, OverlayView, Circle, Polyline, TrafficLayer, useJsApiLoader } from "@react-google-maps/api";
import { IoCarSportSharp } from "react-icons/io5";
import { ImLocation2 } from "react-icons/im";
import { FaSearch } from "react-icons/fa";
import { FiPlus, FiMinus, FiCrosshair, FiLayers, FiX, FiBell, FiCircle, FiNavigation } from "react-icons/fi";
import { FaLocationPinLock } from "react-icons/fa6";
import { apiRequest } from "../lib/api";
import { usePulseColor } from "../lib/usePulseColor";
import { isOutsideGeofences } from "../lib/geofence";
import { VEHICLE_TYPE_ICONS } from "../lib/vehicleIcons";
import { BottomMenu, useAppShell } from "./AppShell";
import BrandIcon from "./BrandIcon";
import FullPageLoading from "./FullPageLoading";
import { GeofenceRecord, RouteRecord } from "../types/auth";
import Switch from "./Switch";
import { useAdminAccess } from "../lib/adminAccess";
import CallButton from "./CallButton";

interface LiveVehicle {
  vehicleId: string;
  plateNumber: string;
  status: string;
  vehicleType?: string;
  driverId?: { _id: string; fullName: string; phone?: string | null } | null;
  lastLocation:
    | {
        latitude: number;
        longitude: number;
        recordedAt: string;
        isMocked?: boolean;
        heading?: number | null;
        speedKph?: number | null;
      }
    | null;
}

const statusColor: Record<string, string> = {
  active: "#2dd4bf",
  idle: "#fb923c",
  offline: "#000000",
  maintenance: "#f87171",
};

const LEGEND_ITEMS = [
  { label: "Active — currently moving", color: "#2dd4bf" },
  { label: "Idle — stationary, engine on", color: "#fb923c" },
  { label: "Offline — no recent signal", color: "#000000" },
  { label: "Maintenance — out of service", color: "#f87171" },
];

const containerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: -1.2921, lng: 36.8219 };


// Eases a marker's displayed position toward wherever its last GPS ping
// actually put it, instead of snapping there instantly. Vehicle data only
// refreshes once per poll (every 10s), so without this every poll was a
// visible "teleport" from the old spot to the new one — this makes that gap
// read as smooth, continuous travel instead of a jump.
const MARKER_TRANSITION_MS = 1500;

function useSmoothLatLng(target: { lat: number; lng: number } | null) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const from = fromRef.current ?? target;

    if (from.lat === target.lat && from.lng === target.lng) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / MARKER_TRANSITION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 2); // ease-out — fast start, gentle stop
      setDisplay({
        lat: from.lat + (target!.lat - from.lat) * eased,
        lng: from.lng + (target!.lng - from.lng) * eased,
      });
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng]);

  return display;
}

// Clicks on things drawn over the map (markers, the "create here" menu)
// otherwise also reach the map itself and would open the menu underneath.
function blockMapClicks(el: HTMLElement | null) {
  if (el) google.maps.OverlayView.preventMapHitsAndGesturesFrom(el);
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
  position,
  outOfGeofence,
  onClick,
}: {
  vehicle: LiveVehicle;
  position: { lat: number; lng: number };
  outOfGeofence: boolean;
  onClick: () => void;
}) {
  const color = statusColor[vehicle.status] || "#9ca3af";
  const [iconFailed, setIconFailed] = useState(false);
  const iconSrc = VEHICLE_TYPE_ICONS[vehicle.vehicleType || ""];
  const heading = vehicle.lastLocation?.heading;
  const speedKph = vehicle.lastLocation?.speedKph;
  const smoothPosition = useSmoothLatLng(position);

  return (
    <OverlayView position={smoothPosition ?? position} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
    <div
      ref={blockMapClicks}
      className="flex flex-col items-center cursor-pointer"
      style={{ transform: "translate(-50%, -100%)" }}
      onClick={onClick}
    >
      <div className="mb-1 w-[84px] flex flex-col items-center gap-0.5 rounded-lg bg-orange-500 px-1.5 py-1.5 shadow-sm">
        <span className="font-bold text-white text-[11px] leading-tight">{vehicle.plateNumber}</span>
        <span className="flex items-center gap-1 text-[10px] font-semibold leading-tight text-white">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {vehicle.status}
        </span>
        {speedKph != null && speedKph > 0 && (
          <span className="text-[10px] font-bold leading-tight text-white">{Math.round(speedKph)} km/h</span>
        )}
        {vehicle.lastLocation && (
          <span className="text-[9px] leading-tight text-orange-100">{timeAgo(vehicle.lastLocation.recordedAt)}</span>
        )}
        {outOfGeofence && <span className="text-[9px] font-bold leading-tight text-red-900">OUTSIDE ZONE</span>}
        {vehicle.lastLocation?.isMocked && (
          <span className="rounded bg-red-900 px-1 text-[9px] font-bold leading-tight text-white" title="Location came from a fake-GPS app">
            FAKE GPS
          </span>
        )}
      </div>

      <div className="relative w-8 h-8">
        {outOfGeofence && (
          <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping" />
        )}
        <div
          className="relative w-8 h-8 transform rounded-full flex items-center justify-center border-2 border-white shadow hover:scale-110 transition-transform"
          style={{
            background: outOfGeofence ? "#ef4444" : color,
            // Composes with the hover:scale-110 utility above via Tailwind's
            // shared --tw-rotate transform variable, rather than overriding
            // it with a plain inline `transform` (which would fight the
            // hover scale instead of combining with it). Only rotates while
            // actually moving — heading is noisy/meaningless when stopped.
            ["--tw-rotate" as string]: heading != null && speedKph && speedKph > 2 ? `${heading}deg` : "0deg",
          }}
        >
          {iconSrc && !iconFailed ? (
            <img
              src={iconSrc}
              alt=""
              aria-hidden="true"
              onError={() => setIconFailed(true)}
              className="h-3.5 w-3.5 brightness-0 invert"
            />
          ) : (
            <IoCarSportSharp size={14} color="white" />
          )}
        </div>
      </div>
    </div>
    </OverlayView>
  );
}

function StartPointMarker() {
  const color = "#0d9488";

  return (
    <div className="flex flex-col items-center" style={{ transform: "translate(-50%, -100%)" }}>
      <div
        className="mb-1 px-2 py-1 rounded shadow-sm bg-white border text-xs font-semibold whitespace-nowrap"
        style={{ borderColor: color, color }}
      >
        Start point
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
  savedStartPoint = null,
}: {
  basePath?: string;
  savedStartPoint?: LatLng | null;
}) {
  const shell = useAppShell();
  const router = useRouter();
  const { canManageFleet, canDispatch } = useAdminAccess();

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
  const [showVehicles, setShowVehicles] = useState(true);
  const [showTraffic, setShowTraffic] = useState(false);
  const [satelliteView, setSatelliteView] = useState(false);

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

  // The map's center is only ever set here once, the first time a vehicle's
  // location arrives — NOT recomputed from `vehicles` on every render. It
  // used to be recalculated from visibleVehicles[0] every render, and since
  // that's a controlled GoogleMap prop, every 10s poll (or any other
  // re-render) silently snapped the map back to that one vehicle, fighting
  // any dragging/zooming the user had just done. The "Recenter on fleet"
  // button already handles manual re-centering imperatively via mapRef.
  const [mapCenter, setMapCenter] = useState<LatLng>(defaultCenter);
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    if (hasCenteredRef.current) return;
    const first = vehicles.find((v) => v.lastLocation);
    if (first) {
      setMapCenter({ lat: first.lastLocation!.latitude, lng: first.lastLocation!.longitude });
      hasCenteredRef.current = true;
    }
  }, [vehicles]);

  // Jumps the map to a specific vehicle — used when an alert toast is
  // clicked. Handed off two ways, same pattern as the AI route/geofence
  // draft handoff: sessionStorage for a fresh navigation to this page, and a
  // CustomEvent for when we're already sitting on it (a push to the same URL
  // is a no-op, so the toast dispatches the event directly instead).
  function jumpToVehicle(vehicleId: string) {
    const map = mapRef.current;
    const target = vehicles.find((v) => v.vehicleId === vehicleId);
    if (!map || !target?.lastLocation) return false;
    map.panTo({ lat: target.lastLocation.latitude, lng: target.lastLocation.longitude });
    map.setZoom(15);
    return true;
  }

  useEffect(() => {
    const pendingVehicleId = sessionStorage.getItem("fleet:jump-to-vehicle");
    if (pendingVehicleId && jumpToVehicle(pendingVehicleId)) {
      sessionStorage.removeItem("fleet:jump-to-vehicle");
    }
  }, [vehicles]);

  // Deliberately no dependency array — jumpToVehicle closes over `vehicles`,
  // which changes every poll, so this must re-attach each render to avoid
  // calling a stale version that can never find a vehicle added/updated
  // after the first render. The re-attach cost is negligible either way.
  useEffect(() => {
    function handleJumpEvent(e: Event) {
      const vehicleId = (e as CustomEvent).detail?.vehicleId;
      if (vehicleId) jumpToVehicle(vehicleId);
    }
    window.addEventListener("fleet:jump-to-vehicle", handleJumpEvent);
    return () => window.removeEventListener("fleet:jump-to-vehicle", handleJumpEvent);
  });

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "idle" | "offline">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  // A spot clicked on the map, with its "create here" menu open.
  const [mapMenu, setMapMenu] = useState<LatLng | null>(null);
  const navHref = (label: string) =>
    shell?.nav.sections.flatMap((sec) => sec.items).find((i) => i.label === label)?.href ?? null;
  const geofencesHref = canManageFleet ? navHref("Geofences") : null;
  const { address: menuAddress, loading: menuAddressLoading } = useAddress(mapMenu?.lat, mapMenu?.lng);
  const routesHref = canDispatch ? navHref("Routes") : null;

  // Hands the spot to the Geofences / Routes page through the same
  // sessionStorage draft the AI assistant uses (see GeofencesManager and
  // RoutesManager).
  function createHere(kind: "geofence" | "route") {
    if (!mapMenu) return;
    if (kind === "geofence" && geofencesHref) {
      sessionStorage.setItem("geofenceDraft", JSON.stringify({ lat: mapMenu.lat, lng: mapMenu.lng, radiusMeters: 500 }));
      router.push(geofencesHref);
    } else if (kind === "route" && routesHref) {
      sessionStorage.setItem("routeDraft", JSON.stringify({ start: mapMenu }));
      router.push(routesHref);
    }
  }

  const counts = {
    all: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
  };

  const outsideZone = (v: LiveVehicle) =>
    !!v.lastLocation && isOutsideGeofences(v.lastLocation.latitude, v.lastLocation.longitude, geofences);
  const outOfZoneCount = geofences.length ? withLocation.filter(outsideZone).length : 0;

  // The card's list narrows as you type (plate, type or driver) and by the
  // status chips; pressing Enter also zooms the map to the matches.
  const query = searchQuery.trim().toLowerCase();
  const listedVehicles = vehicles
    .filter((v) => statusFilter === "all" || v.status === statusFilter)
    .filter(
      (v) =>
        !query ||
        v.plateNumber.toLowerCase().includes(query) ||
        (v.vehicleType && v.vehicleType.toLowerCase().includes(query)) ||
        (v.driverId?.fullName && v.driverId.fullName.toLowerCase().includes(query))
    );

  const selected = vehicles.find((v) => v.vehicleId === selectedId) || null;

  function selectVehicle(v: LiveVehicle) {
    setSelectedId(v.vehicleId);
    const map = mapRef.current;
    if (map && v.lastLocation) {
      map.panTo({ lat: v.lastLocation.latitude, lng: v.lastLocation.longitude });
      if ((map.getZoom() || 12) < 15) map.setZoom(15);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query) {
      setSearchMessage(null);
      return;
    }

    const matches = listedVehicles;
    if (matches.length === 0) {
      setSearchMessage(`No vehicle found matching "${searchQuery.trim()}".`);
      return;
    }

    const matchesOnMap = matches.filter((v) => v.lastLocation);
    if (matchesOnMap.length === 0) {
      setSearchMessage(
        matches.length === 1
          ? `${matches[0].plateNumber} isn't on the map yet — no GPS location received.`
          : `None of the ${matches.length} matches are on the map yet — no GPS location received.`
      );
      return;
    }

    setSearchMessage(null);
    if (matchesOnMap.length === 1) {
      selectVehicle(matchesOnMap[0]);
      return;
    }
    const map = mapRef.current;
    if (map) {
      const bounds = new google.maps.LatLngBounds();
      matchesOnMap.forEach((v) => bounds.extend({ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }));
      map.fitBounds(bounds);
    }
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
    visibleVehicles.forEach((v) => bounds.extend({ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }));
    map.fitBounds(bounds);
  }

  function handleZoom(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom((map.getZoom() || 12) + delta);
  }

  if (loading || !isLoaded) return <FullPageLoading label="Loading map" />;

  const layerToggles = [
    { label: "Vehicles", on: showVehicles, toggle: () => setShowVehicles((s) => !s), show: true },
    { label: "Zones", on: showGeofences, toggle: () => setShowGeofences((s) => !s), show: geofences.length > 0 },
    { label: "Routes", on: showRoutes, toggle: () => setShowRoutes((s) => !s), show: routes.length > 0 },
    { label: "Traffic", on: showTraffic, toggle: () => setShowTraffic((s) => !s), show: true },
    { label: "Satellite", on: satelliteView, toggle: () => setSatelliteView((s) => !s), show: true },
  ];
  const controlClass =
    "flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg ring-1 ring-black/5 hover:text-teal-600";

  return (
    // Traccar's main screen: the map fills the window and everything else
    // floats on top of it.
    <div className="relative h-screen w-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={12}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onClick={(e) => {
          setLayersOpen(false);
          // Everyone gets the spot's address; the create options inside
          // the menu are limited to what the user may do.
          setMapMenu(e.latLng ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : null);
        }}
        mapTypeId={satelliteView ? "satellite" : "roadmap"}
        options={{
          disableDefaultUI: true,
          mapTypeControl: false,
          zoomControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: false,
          scaleControl: false,
          clickableIcons: false,
        }}
      >
        {showTraffic && <TrafficLayer />}

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

        {/* Vehicles — plotted as soon as they have a GPS fix, independent of geofences */}
        {showVehicles &&
          visibleVehicles.map((v) => (
            <VehicleMarker
              key={v.vehicleId}
              vehicle={v}
              position={{ lat: v.lastLocation!.latitude, lng: v.lastLocation!.longitude }}
              outOfGeofence={outsideZone(v)}
              onClick={() => selectVehicle(v)}
            />
          ))}

        {/* Clicked spot — pin plus "create here" menu */}
        {mapMenu && (
          <OverlayView position={mapMenu} mapPaneName={OverlayView.FLOAT_PANE}>
            <div ref={blockMapClicks} className="flex flex-col items-center" style={{ transform: "translate(-50%, -100%)" }}>
              <div className="mb-1 w-64 overflow-hidden rounded-lg bg-white text-left shadow-xl ring-1 ring-black/10">
                <div className="border-b border-gray-100 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">This spot</span>
                    <button
                      onClick={() => setMapMenu(null)}
                      aria-label="Close"
                      className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <FiX size={13} />
                    </button>
                  </div>
                  {/* The address of the clicked spot, looked up as soon as it's picked */}
                  <p
                    className={`mt-1 text-xs leading-snug ${menuAddressLoading ? "animate-pulse text-gray-400" : "text-gray-800"}`}
                    title={`${mapMenu.lat.toFixed(5)}, ${mapMenu.lng.toFixed(5)}`}
                  >
                    {menuAddressLoading
                      ? "Looking up address…"
                      : menuAddress || `${mapMenu.lat.toFixed(5)}, ${mapMenu.lng.toFixed(5)}`}
                  </p>
                </div>
                {geofencesHref && (
                  <button
                    onClick={() => createHere("geofence")}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-teal-50"
                  >
                    <FiCircle size={15} className="shrink-0 text-teal-600" />
                    Create a geofence here
                  </button>
                )}
                {routesHref && (
                  <button
                    onClick={() => createHere("route")}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-teal-50"
                  >
                    <FiNavigation size={15} className="shrink-0 text-blue-600" />
                    Start a route here
                  </button>
                )}
              </div>
              <ImLocation2 size={26} className="text-orange-500 drop-shadow" />
            </div>
          </OverlayView>
        )}

        {/* Driver daily starting point */}
        {savedStartPoint && (
          <OverlayView position={savedStartPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <StartPointMarker />
          </OverlayView>
        )}
      </GoogleMap>

      {/* FLOATING CARD — toolbar, vehicle list, bottom menu. Full width along
          the bottom on phones, a column on the left from md up. */}
      <div className="absolute inset-x-2 bottom-2 z-10 flex max-h-[55vh] flex-col overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/5 md:inset-x-auto md:bottom-3 md:left-3 md:top-3 md:max-h-none md:w-[360px]">
        <div className="border-b border-gray-100 px-3 pt-3 pb-2">
          <div className="mb-2 flex items-center gap-2">
            <BrandIcon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-xs font-bold text-blue-950">
              FIGBLOOM FLEET
              {shell?.companyName && <span className="font-medium text-gray-400"> · {shell.companyName}</span>}
            </span>
            {shell?.nav.alertsHref && (
              <Link
                href={shell.nav.alertsHref}
                aria-label="Alerts"
                className="relative rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <FiBell size={17} />
                {shell.alertCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                    {shell.alertCount > 99 ? "99+" : shell.alertCount}
                  </span>
                )}
              </Link>
            )}
          </div>

          <form
            onSubmit={handleSearch}
            className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 focus-within:border-teal-500"
          >
            <FaSearch className="shrink-0 text-gray-400" size={12} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchMessage(null);
              }}
              placeholder="Search vehicles, types or drivers"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchMessage(null);
                }}
                className="shrink-0 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <FiX size={14} />
              </button>
            )}
          </form>
          {searchMessage && <p className="mt-1.5 text-xs text-gray-500">{searchMessage}</p>}

          <div className="mt-2 flex flex-wrap gap-1">
            {(["all", "active", "idle", "offline"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                  statusFilter === key ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {key} {counts[key]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            {withLocation.length} of {vehicles.length} reporting
            {geofences.length > 0 && (
              <>
                {" · "}
                <span className="text-teal-600">{withLocation.length - outOfZoneCount} in zone</span>
                {" · "}
                <span className={outOfZoneCount ? "font-medium text-red-600" : ""}>{outOfZoneCount} out of zone</span>
              </>
            )}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {listedVehicles.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-400">
              {vehicles.length === 0 ? "No vehicles registered yet." : "No vehicles match."}
            </p>
          ) : (
            listedVehicles.map((v) => (
              <VehicleRow
                key={v.vehicleId}
                vehicle={v}
                outOfZone={outsideZone(v)}
                selected={v.vehicleId === selectedId}
                onClick={() => selectVehicle(v)}
              />
            ))
          )}
        </div>

        <BottomMenu />
      </div>

      {/* MAP CONTROLS — layers, recenter, zoom */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <div className="relative">
          <button onClick={() => setLayersOpen((o) => !o)} title="Map layers" className={controlClass}>
            <FiLayers size={16} />
          </button>
          {layersOpen && (
            <div className="absolute right-11 top-0 w-60 rounded-lg bg-white p-3 shadow-xl ring-1 ring-black/5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Layers</p>
              {layerToggles
                .filter((l) => l.show)
                .map((l) => (
                  <label key={l.label} className="flex cursor-pointer items-center justify-between py-1 text-sm text-gray-700">
                    {l.label}
                    <Switch size="sm" checked={l.on} onChange={l.toggle} />
                  </label>
                ))}
              <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Legend</p>
              <div className="space-y-1">
                {LEGEND_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white shadow" style={{ background: item.color }} />
                    <span className="text-xs text-gray-600">{item.label}</span>
                  </div>
                ))}
                {geofences.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-red-500" />
                    <span className="text-xs text-gray-600">Outside its zone</span>
                  </div>
                )}
                {savedStartPoint && (
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white shadow" style={{ background: "#0d9488" }} />
                    <span className="text-xs text-gray-600">Driver starting point</span>
                  </div>
                )}
                {routes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-3 shrink-0" style={{ background: "#3b82f6" }} />
                    <span className="text-xs text-gray-600">Planned route</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button onClick={handleRecenter} title="Recenter on fleet" className={controlClass}>
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

      {/* STATUS CARD — the selected vehicle, like Traccar's StatusCard */}
      {selected && (
        <StatusCard
          vehicle={selected}
          outOfZone={outsideZone(selected)}
          detailsHref={`${basePath}/${selected.vehicleId}`}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function VehicleRow({
  vehicle,
  outOfZone,
  selected,
  onClick,
}: {
  vehicle: LiveVehicle;
  outOfZone: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const color = statusColor[vehicle.status] || "#9ca3af";
  const iconSrc = VEHICLE_TYPE_ICONS[vehicle.vehicleType || ""];
  const [iconFailed, setIconFailed] = useState(false);
  const speedKph = vehicle.lastLocation?.speedKph;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left transition-colors ${
        selected ? "bg-teal-50" : "hover:bg-gray-50"
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: vehicle.lastLocation ? (outOfZone ? "#ef4444" : color) : "#d1d5db" }}
      >
        {iconSrc && !iconFailed ? (
          <img src={iconSrc} alt="" aria-hidden="true" onError={() => setIconFailed(true)} className="h-4 w-4 brightness-0 invert" />
        ) : (
          <IoCarSportSharp size={16} color="white" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900">{vehicle.plateNumber}</span>
        <span className="block truncate text-xs">
          <span className="font-medium capitalize" style={{ color: vehicle.status === "offline" ? "#6b7280" : color }}>
            {vehicle.status}
          </span>
          <span className="text-gray-400">
            {" · "}
            {vehicle.lastLocation ? timeAgo(vehicle.lastLocation.recordedAt) : "No GPS yet"}
            {vehicle.driverId?.fullName ? ` · ${vehicle.driverId.fullName}` : ""}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-gray-400">
        {vehicle.lastLocation?.isMocked && (
          <span className="rounded bg-red-600 px-1 text-[9px] font-bold text-white" title="Location came from a fake-GPS app">
            FAKE
          </span>
        )}
        {outOfZone && (
          <span title="Outside its zone">
            <FaLocationPinLock size={13} className="text-red-500" />
          </span>
        )}
        {speedKph != null && speedKph > 2 && (
          <span className="text-[11px] font-medium text-gray-600">{Math.round(speedKph)} km/h</span>
        )}
      </span>
    </button>
  );
}

// Street address for a position, looked up by the backend (Google, or
// OpenStreetMap while Google's Geocoding API is off). Rounded to ~11 m so a
// parked vehicle doesn't trigger a new lookup on every 10 s refresh.
function useAddress(lat: number | undefined, lng: number | undefined) {
  const key = lat != null && lng != null ? `${lat.toFixed(4)},${lng.toFixed(4)}` : null;
  const [result, setResult] = useState<{ key: string; address: string | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [la, ln] = key.split(",");
    apiRequest<{ address: string | null }>(`/api/tracking/address?lat=${la}&lng=${ln}`)
      .then((r) => !cancelled && setResult({ key, address: r.address }))
      .catch(() => !cancelled && setResult({ key, address: null }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return { address: null, loading: false };
  return result?.key === key ? { address: result.address, loading: false } : { address: null, loading: true };
}

function StatusCard({
  vehicle,
  outOfZone,
  detailsHref,
  onClose,
}: {
  vehicle: LiveVehicle;
  outOfZone: boolean;
  detailsHref: string;
  onClose: () => void;
}) {
  const loc = vehicle.lastLocation;
  const color = statusColor[vehicle.status] || "#9ca3af";
  const { address, loading: addressLoading } = useAddress(loc?.latitude, loc?.longitude);
  const rows: [string, string][] = [
    ["Status", vehicle.status],
    ["Driver", vehicle.driverId?.fullName || "Not assigned"],
    ["Speed", loc?.speedKph != null ? `${Math.round(loc.speedKph)} km/h` : "—"],
    ["Last update", loc ? `${timeAgo(loc.recordedAt)} (${new Date(loc.recordedAt).toLocaleTimeString()})` : "No GPS yet"],
  ];
  // Falls back to the raw coordinates if no address could be found.
  const addressText = !loc
    ? "—"
    : addressLoading
      ? "Looking up address…"
      : address || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;

  return (
    <div className="absolute inset-x-2 top-2 z-20 rounded-lg bg-white shadow-xl ring-1 ring-black/5 md:inset-x-auto md:bottom-3 md:left-[384px] md:top-auto md:w-80">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="flex-1 truncate text-sm font-semibold text-gray-900">{vehicle.plateNumber}</span>
        {vehicle.vehicleType && <span className="text-xs capitalize text-gray-400">{vehicle.vehicleType}</span>}
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <FiX size={15} />
        </button>
      </div>
      {(outOfZone || loc?.isMocked) && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {outOfZone && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Outside its zone</span>}
          {loc?.isMocked && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Fake GPS</span>}
        </div>
      )}
      <dl className="space-y-1.5 px-4 py-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 text-xs">
            <dt className="text-gray-500">{label}</dt>
            <dd className="truncate text-right font-medium text-gray-800">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 text-xs">
          <dt className="shrink-0 text-gray-500">Address</dt>
          <dd
            className={`text-right font-medium ${addressLoading ? "text-gray-400" : "text-gray-800"}`}
            title={loc ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : undefined}
          >
            {addressText}
          </dd>
        </div>
      </dl>
      <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5">
        {vehicle.driverId && <CallButton phone={vehicle.driverId.phone} name={vehicle.driverId.fullName} size="xs" label="Call driver" />}
        <Link href={detailsHref} className="ml-auto text-xs font-semibold text-teal-700 hover:underline">
          Details & history
        </Link>
      </div>
    </div>
  );
}
