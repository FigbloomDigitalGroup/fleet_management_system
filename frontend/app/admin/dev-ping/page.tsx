"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { VehicleRecord } from "../../types/auth";

export default function DevPingPage() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [latitude, setLatitude] = useState("-1.2921");
  const [longitude, setLongitude] = useState("36.8219");
  const [speedKph, setSpeedKph] = useState("0");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<VehicleRecord[]>("/api/vehicles").then((data) => {
      setVehicles(data);
      if (data.length > 0) setVehicleId(data[0]._id);
    });
  }, []);

  async function sendPing(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsSending(true);
    try {
      const data = await apiRequest("/api/tracking/ping", {
        method: "POST",
        body: JSON.stringify({
          vehicleId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          speedKph: parseFloat(speedKph),
        }),
      });
      setResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setError(err.message || "Failed to send ping");
    } finally {
      setIsSending(false);
    }
  }

  // Quick-fill buttons for the test sequence we planned
  const presets = [
    { label: "1. Stationary", lat: "-1.2921", lng: "36.8219", speed: "0" },
    { label: "2. Start moving", lat: "-1.2935", lng: "36.8225", speed: "45" },
    { label: "3. Speeding", lat: "-1.2950", lng: "36.8240", speed: "95" },
    { label: "4. Stop", lat: "-1.2965", lng: "36.8255", speed: "0" },
  ];

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Send Test Ping</h1>
        <p className="text-sm text-gray-500 mt-1">
          Simulates a GPS device sending a location update — for testing only.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <form onSubmit={sendPing} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400"
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
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Speed (km/h)</label>
              <input
                type="text"
                value={speedKph}
                onChange={(e) => setSpeedKph(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400"
              />
            </div>
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
                  }}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-600"
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