"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IoCarSportSharp } from "react-icons/io5";
import { FiCheckCircle } from "react-icons/fi";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { usePageHeader } from "../../components/DashboardShell";
import { VehicleRecord } from "../../types/auth";

const POLL_INTERVAL_MS = 10000;

const statusStyles: Record<string, string> = {
  active: "bg-teal-50 text-teal-600 border-teal-200",
  idle: "bg-orange-50 text-orange-600 border-orange-200",
  offline: "bg-gray-100 text-gray-500 border-gray-200",
  maintenance: "bg-red-50 text-red-600 border-red-200",
};

export default function DriverDashboard() {
  const { user } = useAuth();
  usePageHeader("My vehicle", "The vehicle currently assigned to you — this updates on its own.");

  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const hasLoadedOnce = useRef(false);

  const loadVehicle = useCallback(async () => {
    try {
      const data = await apiRequest<VehicleRecord | null>("/api/vehicles/mine");
      setVehicle(data);
      setLastSynced(new Date());
    } catch {
      // Keep showing the last known assignment rather than clearing it on a
      // transient network hiccup — the next poll will recover on its own.
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicle();
    const interval = setInterval(loadVehicle, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadVehicle]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
        </span>
        Live — updates automatically, no refresh needed
        {lastSynced && <span className="text-gray-300">· synced {lastSynced.toLocaleTimeString()}</span>}
      </div>

      {loading && !hasLoadedOnce.current ? (
        <div className="skeleton-shimmer h-40 rounded-lg" />
      ) : vehicle ? (
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
                <IoCarSportSharp size={26} className="text-teal-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-blue-950">{vehicle.plateNumber}</p>
                <p className="text-sm text-gray-500">
                  {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "No make/model on file"}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[vehicle.status] || statusStyles.offline}`}
            >
              {vehicle.status}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded bg-teal-50/60 px-3.5 py-2.5 text-sm text-teal-700">
            <FiCheckCircle size={16} />
            You&apos;re assigned to this vehicle, {user?.fullName?.split(" ")[0] || "driver"}.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <IoCarSportSharp size={26} className="text-gray-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-gray-700">No vehicle assigned yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Once your admin assigns you a vehicle, it will show up here automatically.
          </p>
        </div>
      )}
    </div>
  );
}
