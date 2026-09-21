"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { CompanyRecord, VehicleRecord } from "../../types/auth";
import { usePageHeader } from "../../components/DashboardShell";

export default function DevPingPage() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [latitude, setLatitude] = useState("-1.2921");
  const [longitude, setLongitude] = useState("36.8219");
  const [speedKph, setSpeedKph] = useState("0");
  const [fuelLevelLiters, setFuelLevelLiters] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startPoint, setStartPoint] = useState<{ lat: string; lng: string } | null>(null);

  useEffect(() => {
    apiRequest<VehicleRecord[]>("/api/vehicles").then((data) => {
      setVehicles(data);
      if (data.length > 0) setVehicleId(data[0]._id);
    });
  }, []);

  // Default the ping coordinates to the company's daily starting point (once
  // it loads), so test pings land inside a geofence and actually show up on
  // the live map, instead of a hardcoded spot that may be outside any zone.
  useEffect(() => {
    apiRequest<CompanyRecord>("/api/companies/me")
      .then((company) => {
        if (company.dailyStartPoint) {
          const point = { lat: String(company.dailyStartPoint.lat), lng: String(company.dailyStartPoint.lng) };
          setStartPoint(point);
          setLatitude(point.lat);
          setLongitude(point.lng);
        }
      })
      .catch(() => {});
  }, []);

  async function sendPing(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsSending(true);
    try {
      const body: Record<string, any> = {
        vehicleId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
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
    } catch (err: any) {
      setError(err.message || "Failed to send ping");
    } finally {
      setIsSending(false);
    }
  }

  // Presets 1 and 5 represent the vehicle sitting at its base — use the
  // company's actual starting point when one is set, so it lands inside a
  // geofence instead of the old hardcoded demo coordinates.
  const baseLat = startPoint?.lat ?? "-1.2921";
  const baseLng = startPoint?.lng ?? "36.8219";

  const presets = [
    { label: "1. Stationary", lat: baseLat, lng: baseLng, speed: "0", fuel: "" },
    { label: "2. Start moving", lat: "-1.2935", lng: "36.8225", speed: "45", fuel: "" },
    { label: "3. Speeding", lat: "-1.2950", lng: "36.8240", speed: "95", fuel: "" },
    { label: "4. Stop", lat: "-1.2965", lng: "36.8255", speed: "0", fuel: "" },
    { label: "5. Fuel A (full)", lat: baseLat, lng: baseLng, speed: "40", fuel: "50" },
    { label: "6. Fuel B (anomaly)", lat: "-1.2925", lng: "36.8222", speed: "40", fuel: "35" },
    { label: "7. Off-route", lat: "-1.3100", lng: "36.8400", speed: "40", fuel: "" },
  ];

  usePageHeader("Send Test Ping", "Simulates a GPS device sending a location update — for testing only.");

  return (
    <div className="max-w-xl">

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <form onSubmit={sendPing} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
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
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400"
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

          {/* Quick-fill preset buttons */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Quick fill:</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setLatitude(p.lat);
                    setLongitude(p.lng);
                    setSpeedKph(p.speed);
                    setFuelLevelLiters(p.fuel);
                  }}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:border-teal-400 hover:text-teal-600"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSending || !vehicleId}
            className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
          >
            {isSending ? "Sending…" : "Send ping"}
          </button>
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