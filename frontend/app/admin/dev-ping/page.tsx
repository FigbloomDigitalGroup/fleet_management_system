"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { CompanyRecord, GeofenceRecord, VehicleRecord } from "../../types/auth";
import { usePageHeader } from "../../components/DashboardShell";

const LIVE_INTERVAL_MS = 5000;

function geofenceCenter(geofence: GeofenceRecord): { lat: number; lng: number } | null {
  if (geofence.type === "circle" && geofence.centerLat != null && geofence.centerLng != null) {
    return { lat: geofence.centerLat, lng: geofence.centerLng };
  }
  if (geofence.type === "polygon" && geofence.polygon && geofence.polygon.length > 0) {
    const lat = geofence.polygon.reduce((sum, p) => sum + p.lat, 0) / geofence.polygon.length;
    const lng = geofence.polygon.reduce((sum, p) => sum + p.lng, 0) / geofence.polygon.length;
    return { lat, lng };
  }
  return null;
}

export default function DevPingPage() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [latitude, setLatitude] = useState("-1.2921");
  const [longitude, setLongitude] = useState("36.8219");
  const [speedKph, setSpeedKph] = useState("0");
  const [fuelLevelLiters, setFuelLevelLiters] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [pingCount, setPingCount] = useState(0);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bearingRef = useRef(0);

  useEffect(() => {
    apiRequest<VehicleRecord[]>("/api/vehicles").then((data) => {
      setVehicles(data);
      if (data.length > 0) setVehicleId(data[0]._id);
    });
    apiRequest<GeofenceRecord[]>("/api/geofences").then(setGeofences).catch(() => {});
    apiRequest<CompanyRecord>("/api/companies/me").then(setCompany).catch(() => {});
  }, []);

  // Default the ping coordinates to this specific vehicle's own starting
  // point (its startGeofenceId override, if set) or the company's daily
  // starting point otherwise — same resolution order the real driver flow
  // uses — so test pings land inside a geofence and actually show up on
  // the live map, instead of a hardcoded spot or a stale default from
  // whichever vehicle was selected last.
  useEffect(() => {
    if (!vehicleId) return;
    const vehicle = vehicles.find((v) => v._id === vehicleId);
    const overrideGeofence = vehicle?.startGeofenceId
      ? geofences.find((g) => g._id === vehicle.startGeofenceId!._id)
      : null;
    const resolved =
      (overrideGeofence && geofenceCenter(overrideGeofence)) ||
      (company?.dailyStartPoint ? { lat: company.dailyStartPoint.lat, lng: company.dailyStartPoint.lng } : null);

    if (resolved) {
      setLatitude(String(resolved.lat));
      setLongitude(String(resolved.lng));
    }
  }, [vehicleId, vehicles, geofences, company]);

  async function sendPing(overrides?: { latitude: number; longitude: number }) {
    setError(null);
    try {
      const body: Record<string, any> = {
        vehicleId,
        latitude: overrides?.latitude ?? parseFloat(latitude),
        longitude: overrides?.longitude ?? parseFloat(longitude),
        speedKph: parseFloat(speedKph),
      };
      if (fuelLevelLiters.trim() !== "") {
        body.fuelLevelLiters = parseFloat(fuelLevelLiters);
      }

      const data = await apiRequest("/api/tracking/ping", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(JSON.stringify(data, null, 2));
      setPingCount((c) => c + 1);
      if (overrides) {
        setLatitude(String(overrides.latitude));
        setLongitude(String(overrides.longitude));
      }
    } catch (err: any) {
      setError(err.message || "Failed to send ping");
      stopLive();
    }
  }

  async function handleManualSend(e: FormEvent) {
    e.preventDefault();
    setIsSending(true);
    await sendPing();
    setIsSending(false);
  }

  // Consistently sends a ping every few seconds while "live" — a stand-in
  // for a real GPS device/tracker until that's wired up. When the vehicle
  // is set to move (speed > 0), each tick nudges the position along a
  // fixed bearing chosen at start, so the live map shows real movement
  // instead of the same point repeating.
  function startLive() {
    if (isLive) return;
    bearingRef.current = Math.random() * 360;
    setIsLive(true);
    setPingCount(0);

    liveIntervalRef.current = setInterval(() => {
      const speed = parseFloat(speedKph) || 0;
      if (speed <= 0) {
        sendPing();
        return;
      }
      const distanceKm = speed * (LIVE_INTERVAL_MS / 3600000);
      const bearingRad = (bearingRef.current * Math.PI) / 180;
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const dLat = (distanceKm / 111) * Math.cos(bearingRad);
      const dLng = (distanceKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(bearingRad);
      sendPing({ latitude: lat + dLat, longitude: lng + dLng });
    }, LIVE_INTERVAL_MS);
  }

  function stopLive() {
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    liveIntervalRef.current = null;
    setIsLive(false);
  }

  useEffect(() => () => stopLive(), []);

  const presets = [
    { label: "1. Stationary", speed: "0", fuel: "" },
    { label: "2. Start moving", speed: "45", fuel: "" },
    { label: "3. Speeding", speed: "95", fuel: "" },
    { label: "5. Fuel A (full)", speed: "40", fuel: "50" },
    { label: "6. Fuel B (anomaly)", speed: "40", fuel: "35" },
  ];

  usePageHeader("Send Test Ping", "Simulates a GPS device sending a location update — for testing only.");

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <form onSubmit={handleManualSend} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={isLive}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400 disabled:opacity-60"
            >
              {vehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.plateNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                disabled={isLive}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                disabled={isLive}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Speed (km/h)</label>
              <input
                type="text"
                value={speedKph}
                onChange={(e) => setSpeedKph(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fuel level (liters) <span className="text-gray-400">— optional, leave blank if no sensor</span>
            </label>
            <input
              type="text"
              value={fuelLevelLiters}
              onChange={(e) => setFuelLevelLiters(e.target.value)}
              placeholder="e.g. 50"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
            />
          </div>

          {/* Quick-fill preset buttons — only set speed/fuel now; position
              comes from the vehicle's own resolved starting point above,
              and live mode drifts it from there. */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Quick fill:</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={isLive}
                  onClick={() => {
                    setSpeedKph(p.speed);
                    setFuelLevelLiters(p.fuel);
                  }}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:border-teal-400 hover:text-teal-600 disabled:opacity-60"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSending || isLive || !vehicleId}
              className="flex-1 py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
            >
              {isSending ? "Sending…" : "Send ping"}
            </button>
            <button
              type="button"
              onClick={isLive ? stopLive : startLive}
              disabled={!vehicleId}
              className={`flex-1 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60 ${
                isLive ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700"
              }`}
            >
              {isLive ? "Stop live simulation" : "Start live simulation"}
            </button>
          </div>

          {isLive && (
            <div className="flex items-center gap-1.5 text-xs text-teal-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              Live — sending a ping every {LIVE_INTERVAL_MS / 1000}s ({pingCount} sent)
            </div>
          )}
        </form>

        {result && (
          <pre className="mt-4 text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-x-auto">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
