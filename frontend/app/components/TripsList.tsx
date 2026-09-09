"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import FullPageLoading from "@/app/components/FullPageLoading";
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

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-black text-xs uppercase">
          <tr>
            <th className="text-left px-5 py-3 font-bold">Vehicle</th>
            <th className="text-left px-5 py-3 font-bold">Driver</th>
            <th className="text-left px-5 py-3 font-bold">Start</th>
            <th className="text-left px-5 py-3 font-bold">Distance</th>
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
                <td className="px-5 py-3 font-medium text-blue-950">
                  {t.vehicleId?.plateNumber || "—"}
                </td>
                <td className="px-5 py-3 text-blue-950">{t.driverId?.fullName || "Unassigned"}</td>
                <td className="px-5 py-3 text-blue-950">{new Date(t.startTime).toLocaleString()}</td>
                <td className="px-5 py-3 text-blue-950">
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