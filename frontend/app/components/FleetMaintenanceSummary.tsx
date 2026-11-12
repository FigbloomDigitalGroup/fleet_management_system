"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { MaintenanceItem } from "../types/auth";
import Skeleton from "./Skeleton";

const STATE_STYLES: Record<string, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-red-50 text-red-600 border-red-200" },
  due_soon: { label: "Due soon", className: "bg-orange-50 text-orange-600 border-orange-200" },
  upcoming: { label: "Upcoming", className: "bg-gray-100 text-gray-500 border-gray-200" },
};
const ORDER = { overdue: 0, due_soon: 1, upcoming: 2 } as const;

// Every open service reminder across the fleet, most urgent first. Each
// vehicle's full service history and its reminders are edited on the
// vehicle's own page.
export default function FleetMaintenanceSummary({ basePath }: { basePath: "/company" | "/admin" }) {
  const [items, setItems] = useState<MaintenanceItem[] | null>(null);

  useEffect(() => {
    apiRequest<{ items: MaintenanceItem[] }>("/api/maintenance")
      .then((d) => setItems(d.items.filter((i) => i.state)))
      .catch(() => setItems([]));
  }, []);

  const sorted = (items ?? []).slice().sort((a, b) => ORDER[a.state!] - ORDER[b.state!]);

  return (
    <section className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="text-sm font-semibold text-gray-900">Maintenance due</h2>
      <p className="mt-0.5 text-xs text-teal-600">
        Service reminders across your fleet. Add or complete one from the vehicle&apos;s page (Vehicles → a vehicle → Maintenance).
      </p>
      <div className="mt-3">
        {items === null ? (
          <Skeleton rows={2} />
        ) : sorted.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No service reminders yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorted.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATE_STYLES[r.state!].className}`}>
                  {STATE_STYLES[r.state!].label}
                </span>
                <span className="min-w-0 flex-1 font-medium text-gray-900">{r.title}</span>
                {r.dueDate && <span className="text-xs text-gray-500">by {new Date(r.dueDate).toLocaleDateString()}</span>}
                {r.vehicleId && (
                  <Link href={`${basePath}/vehicles/${r.vehicleId._id}`} className="text-xs font-semibold text-teal-700 hover:underline">
                    {r.vehicleId.plateNumber}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
