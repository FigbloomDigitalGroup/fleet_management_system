"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiCheck, FiChevronDown, FiChevronRight, FiX } from "react-icons/fi";
import { API_URL, apiRequest } from "../lib/api";
import { formatDateTime } from "../lib/dateKeys";
import { InspectionRecord } from "../types/auth";
import Skeleton from "./Skeleton";
import WheelIcon from "./WheelIcon";
import Switch from "./Switch";

// Pre-trip inspections — the whole fleet on the Inspections page, or just
// one vehicle's when `vehicleId` is given (vehicle detail page).
export default function InspectionsList({ vehicleId }: { vehicleId?: string }) {
  const pathname = usePathname();
  const vehiclesPath = pathname?.startsWith("/admin") ? "/admin/vehicles" : "/company/vehicles";
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [failedOnly, setFailedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (vehicleId) params.set("vehicleId", vehicleId);
    if (failedOnly) params.set("passed", "false");
    setLoading(true);
    apiRequest<InspectionRecord[]>(`/api/inspections?${params}`)
      .then((data) => {
        if (cancelled) return;
        setInspections(data);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message || "Failed to load inspections"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, failedOnly]);

  const shown = vehicleId ? inspections.slice(0, 10) : inspections;

  return (
    <div className={vehicleId ? "" : "overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5"}>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${vehicleId ? "mb-3" : "px-5 pt-4"}`}>
        <p className="text-xs text-teal-600">
          {vehicleId ? "Latest checks drivers did on this vehicle" : "Most recent 100 checks across your fleet"}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600">
          <Switch size="sm" checked={failedOnly} onChange={setFailedOnly} />
          Failed only
        </label>
      </div>

      {loading && <Skeleton rows={3} rowClassName="h-12" className={vehicleId ? "" : "p-5"} />}
      {error && <p className={`text-sm text-red-600 ${vehicleId ? "" : "p-5"}`}>{error}</p>}
      {!loading && !error && shown.length === 0 && (
        <p className={`text-sm text-gray-400 ${vehicleId ? "" : "px-5 py-8 text-center"}`}>
          {failedOnly ? "No failed inspections." : "No inspections submitted yet."}
        </p>
      )}

      {!loading && !error && shown.length > 0 && (
        <ul className={vehicleId ? "divide-y divide-gray-100 rounded border border-gray-100" : "mt-2 divide-y divide-gray-100 border-t border-gray-100"}>
          {shown.map((insp) => {
            const isOpen = expanded === insp._id;
            const failedItems = insp.items.filter((i) => !i.ok);
            return (
              <li key={insp._id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : insp._id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  {isOpen ? <FiChevronDown className="shrink-0 text-gray-400" /> : <FiChevronRight className="shrink-0 text-gray-400" />}
                  <span className="w-40 shrink-0 text-xs text-gray-600">{formatDateTime(insp.createdAt)}</span>
                  {!vehicleId && insp.vehicleId && (
                    <Link
                      href={`${vehiclesPath}/${insp.vehicleId._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 text-xs font-bold text-blue-950 hover:text-teal-600"
                    >
                      <WheelIcon size={16} className="spin-slow shrink-0" />
                      {insp.vehicleId.plateNumber}
                    </Link>
                  )}
                  <span className="text-xs text-gray-600">{insp.driverId?.fullName ?? ""}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {!insp.passed && (
                      <span className="text-xs text-gray-500">
                        {failedItems.length} issue{failedItems.length === 1 ? "" : "s"}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        insp.passed ? "border-teal-200 bg-teal-50 text-teal-600" : "border-red-200 bg-red-50 text-red-600"
                      }`}
                    >
                      {insp.passed ? "Passed" : "Failed"}
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="bg-gray-50 px-4 pb-4 pt-1">
                    {(insp.odometerKm != null || insp.notes) && (
                      <p className="mb-2 text-xs text-gray-600">
                        {insp.odometerKm != null && <>Odometer {insp.odometerKm.toLocaleString()} km. </>}
                        {insp.notes}
                      </p>
                    )}
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {insp.items.map((item) => (
                        <li
                          key={item.key}
                          className={`rounded bg-white p-2.5 text-sm ring-1 ${item.ok ? "ring-black/5" : "ring-red-200"}`}
                        >
                          <div className="flex items-center gap-2">
                            {item.ok ? <FiCheck className="text-teal-600" /> : <FiX className="text-red-600" />}
                            <span className={item.ok ? "text-gray-700" : "font-medium text-red-700"}>{item.label}</span>
                          </div>
                          {item.note && <p className="mt-1 pl-6 text-xs text-gray-500">{item.note}</p>}
                          {item.photoUrl && (
                            <a href={API_URL + item.photoUrl} target="_blank" rel="noreferrer" className="mt-2 block pl-6">
                              <img src={API_URL + item.photoUrl} alt={item.label} className="h-24 rounded object-cover ring-1 ring-black/5" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
