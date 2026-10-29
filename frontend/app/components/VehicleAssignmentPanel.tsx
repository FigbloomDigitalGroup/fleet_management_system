"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { apiRequest } from "../lib/api";
import { VehicleRecord } from "../types/auth";
import WheelIcon from "./WheelIcon";

// Right side of the Overview's hero card: how many vehicles the company
// has, and how many have a driver assigned. Refreshes every minute.
export default function VehicleAssignmentPanel({ vehiclesHref }: { vehiclesHref: string }) {
  const [counts, setCounts] = useState<{ total: number; assigned: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiRequest<VehicleRecord[]>("/api/vehicles")
        .then((vehicles) => {
          if (cancelled) return;
          setCounts({ total: vehicles.length, assigned: vehicles.filter((v) => v.driverId).length });
        })
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const total = counts?.total ?? 0;
  const assigned = counts?.assigned ?? 0;
  const unassigned = total - assigned;
  const assignedPct = total ? Math.round((assigned / total) * 100) : 0;

  return (
    <div className="relative flex w-full shrink-0 flex-col justify-center gap-3 sm:w-56">
      <div className="flex items-center gap-3">
        <WheelIcon className="spin-slow shrink-0 text-teal-600/30" size={44} />
        <div>
          <p className="text-3xl font-bold leading-none text-blue-950">{counts ? total : "–"}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">{total === 1 ? "vehicle" : "vehicles"} in your fleet</p>
        </div>
      </div>

      {/* Assigned share of the fleet */}
      <div
        className="flex h-2 overflow-hidden rounded-full bg-orange-100"
        role="img"
        aria-label={`${assigned} assigned, ${unassigned} unassigned`}
      >
        <div className="h-full rounded-full bg-teal-600 transition-all duration-500" style={{ width: `${assignedPct}%` }} />
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-teal-50 px-2.5 py-1.5">
          <dt className="flex items-center gap-1.5 text-[11px] font-medium text-teal-600">
            <span className="h-2 w-2 rounded-full bg-teal-600" aria-hidden="true" />
            Assigned
          </dt>
          <dd className="text-lg font-bold text-blue-950">{counts ? assigned : "–"}</dd>
        </div>
        <div className="rounded-md bg-orange-50 px-2.5 py-1.5">
          <dt className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600">
            <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
            Unassigned
          </dt>
          <dd className="text-lg font-bold text-blue-950">{counts ? unassigned : "–"}</dd>
        </div>
      </dl>

      <Link href={vehiclesHref} className="inline-flex items-center gap-1 self-end text-xs font-medium text-teal-600 hover:underline">
        {unassigned > 0 ? "Assign drivers" : "View vehicles"} <FiArrowRight size={12} />
      </Link>
    </div>
  );
}
