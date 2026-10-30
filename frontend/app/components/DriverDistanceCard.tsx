"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { formatDateTime } from "../lib/dateKeys";
import { TripRecord, VehicleRecord } from "../types/auth";
import Skeleton from "./Skeleton";

// The driver app works out its distances from the latest 50 trips of the
// driver's vehicle; this card uses the same trips and the same sums, so the
// numbers here match what the driver sees on their phone.
const APP_TRIP_LIMIT = 50;
const RECENT_SHOWN = 8;

// Midnight six days ago: the app's "this week" is today plus the six days
// before it.
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const km = (value: number) => `${value.toFixed(1)} km`;

export default function DriverDistanceCard({ vehicle, basePath }: { vehicle: VehicleRecord | null; basePath: string }) {
  const [trips, setTrips] = useState<TripRecord[] | null>(null);

  useEffect(() => {
    if (!vehicle) return;
    apiRequest<TripRecord[]>(`/api/trips?vehicleId=${vehicle._id}`)
      .then((list) => setTrips(list.slice(0, APP_TRIP_LIMIT)))
      .catch(() => setTrips([]));
  }, [vehicle]);

  const since = weekStart();
  const week = (trips ?? []).filter((t) => new Date(t.startTime).getTime() >= since);
  const total = (trips ?? []).reduce((sum, t) => sum + (t.distanceKm || 0), 0);
  const weekTotal = week.reduce((sum, t) => sum + (t.distanceKm || 0), 0);

  return (
    <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5">
      <h3 className="text-sm font-medium text-gray-700">Distance</h3>
      <p className="text-xs text-teal-600 mt-0.5 mb-3">The same figures the driver sees in the mobile app</p>

      {!vehicle ? (
        <p className="text-sm text-gray-400">No vehicle assigned, so no trips to count yet.</p>
      ) : trips === null ? (
        <Skeleton rows={3} rowClassName="h-10" />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Total distance</dt>
              <dd className="mt-0.5 font-figures text-xl font-semibold text-gray-900">{total.toFixed(0)} km</dd>
            </div>
            <div>
              <dt className="text-gray-500">This week</dt>
              <dd className="mt-0.5 font-figures text-xl font-semibold text-gray-900">{km(weekTotal)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Trips this week</dt>
              <dd className="mt-0.5 font-figures text-xl font-semibold text-gray-900">{week.length}</dd>
            </div>
          </dl>

          {trips.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">No trips recorded for {vehicle.plateNumber} yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
              {trips.slice(0, RECENT_SHOWN).map((t) => (
                <li key={t._id}>
                  <Link
                    href={`${basePath}/trips/${t._id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:text-teal-600"
                  >
                    <span className="text-gray-600">{formatDateTime(t.startTime)}</span>
                    <span className="font-medium text-teal-600">{km(t.distanceKm || 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-gray-400">
            Total covers the latest {APP_TRIP_LIMIT} trips of {vehicle.plateNumber}, as in the app.
          </p>
        </>
      )}
    </div>
  );
}
