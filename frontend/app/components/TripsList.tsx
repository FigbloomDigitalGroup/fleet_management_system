"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { TripRecord } from "../types/auth";
import FullPageLoading from "./FullPageLoading";

export default function TripsList({ basePath = "/admin/trips" }: { basePath?: string }) {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<TripRecord[]>("/api/trips")
      .then(setTrips)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoading label="Loading trips" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
      <p className="text-xs text-teal-600 px-5 pt-4">
        Every recorded trip, most recent first — tap a vehicle to see its full route.
      </p>
      <table className="w-full text-sm mt-2">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="text-left px-5 py-3 font-medium">Vehicle</th>
            <th className="text-left px-5 py-3 font-medium">Driver</th>
            <th className="text-left px-5 py-3 font-medium">Start</th>
            <th className="text-left px-5 py-3 font-medium">Status</th>
            <th className="text-left px-5 py-3 font-medium">Distance</th>
          </tr>
        </thead>
        <tbody>
          {trips.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                No trips recorded yet.
              </td>
            </tr>
          ) : (
            trips.map((t) => (
              <tr key={t._id} className="border-t border-gray-100">
                <td className="px-5 py-3 text-xs font-bold text-teal-600 hover:underline">
                  <Link href={`${basePath}/${t._id}`}>{t.vehicleId?.plateNumber || "View trip"}</Link>
                </td>
                <td className="px-5 py-3 text-gray-600">{t.driverId?.fullName || "Unassigned"}</td>
                <td className="px-5 py-3 text-gray-600">{new Date(t.startTime).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full border ${t.endTime
                        ? "bg-gray-100 text-gray-500 border-gray-200"
                        : "bg-teal-50 text-teal-600 border-teal-200"
                      }`}
                  >
                    {t.endTime ? "completed" : "in progress"}
                  </span>
                </td>
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