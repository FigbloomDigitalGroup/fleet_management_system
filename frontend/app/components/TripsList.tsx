"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { TripRecord } from "../types/auth";

export default function TripsList() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<TripRecord[]>("/api/trips")
      .then(setTrips)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="text-left px-5 py-3 font-medium">Vehicle</th>
            <th className="text-left px-5 py-3 font-medium">Driver</th>
            <th className="text-left px-5 py-3 font-medium">Start</th>
            <th className="text-left px-5 py-3 font-medium">Distance</th>
          </tr>
        </thead>
        <tbody>
          {trips.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                No trips recorded yet.
              </td>
            </tr>
          ) : (
            trips.map((t) => (
              <tr key={t._id} className="border-t border-gray-100">
                <td className="px-5 py-3 font-medium text-gray-900">
                  {t.vehicleId?.plateNumber || "—"}
                </td>
                <td className="px-5 py-3 text-gray-600">{t.driverId?.fullName || "Unassigned"}</td>
                <td className="px-5 py-3 text-gray-600">{new Date(t.startTime).toLocaleString()}</td>
                <td className="px-5 py-3 text-gray-600">
                  {t.distanceKm ? `${t.distanceKm.toFixed(1)} km` : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}