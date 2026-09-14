"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
import { VehicleRecord } from "../../types/auth";

interface PingLog {
  time: string;
  lat: number;
  lng: number;
  speedKph: number;
  status: "ok" | "error";
  message?: string;
}

export default function LiveTrackerPage() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number; speedKph: number } | null>(null);
  const [logs, setLogs] = useState<PingLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    apiRequest<VehicleRecord[]>("/api/vehicles").then((data) => {
      setVehicles(data);
      if (data.length > 0) setVehicleId(data[0]._id);
    });
  }, []);

  function startTracking() {
    if (!vehicleId) {
      setError("Select a vehicle first.");
      return;
    }
    if (!navigator.geolocation) {
      setError("This browser doesn't support GPS location.");
      return;
    }

    setError(null);
    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, speed } = position.coords;
        // speed comes in meters/second from the browser; convert to km/h
        const speedKph = speed && speed > 0 ? Math.round(speed * 3.6) : 0;

        setCurrentPosition({ lat: latitude, lng: longitude, speedKph });

        try {
          await apiRequest("/api/tracking/ping", {
            method: "POST",
            body: JSON.stringify({ vehicleId, latitude, longitude, speedKph }),
          });
          setLogs((prev) =>
            [{ time: new Date().toLocaleTimeString(), lat: latitude, lng: longitude, speedKph, status: "ok" as const }, ...prev].slice(0, 20)
          );
        } catch (err: any) {
          setLogs((prev) =>
            [
              {
                time: new Date().toLocaleTimeString(),
                lat: latitude,
                lng: longitude,
                speedKph,
                status: "error" as const,
                message: err.message,
              },
              ...prev,
            ].slice(0, 20)
          );
        }
      },
      (geoError) => {
        setError(`GPS error: ${geoError.message}`);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Live Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">
          Uses your phone's real GPS to send live location pings — open this page on your phone's browser.
        </p>
      </div>

      <div className="bg-white rounded-lg p-5 mb-6">
        <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          disabled={isTracking}
          className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400 mb-4"
        >
          {vehicles.map((v) => (
            <option key={v._id} value={v._id}>
              {v.plateNumber}
            </option>
          ))}
        </select>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {!isTracking ? (
          <button
            onClick={startTracking}
            className="w-full py-3 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600"
          >
            Start Tracking
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="w-full py-3 rounded-md text-sm font-medium text-white bg-gray-700 hover:bg-gray-800"
          >
            Stop Tracking
          </button>
        )}

        {isTracking && currentPosition && (
          <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Sending live location — {currentPosition.speedKph} km/h
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="bg-white rounded-lg overflow-hidden">
          <p className="text-xs font-medium text-gray-500 p-4 pb-0">Recent pings</p>
          <table className="w-full text-sm mt-2">
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-500">{log.time}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{log.speedKph} km/h</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${log.status === "ok"
                          ? "bg-green-50 text-green-600 border-green-200"
                          : "bg-red-50 text-red-600 border-red-200"
                        }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}