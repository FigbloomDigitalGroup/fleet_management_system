"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaRoute } from "react-icons/fa";
import { apiRequest, errorMessage } from "../lib/api";
import { TripRecord, VehicleRecord } from "../types/auth";
import { estimateFuelRangeLiters } from "../lib/routeEstimate";
import { toDateInput } from "../lib/dateKeys";
import Skeleton from "./Skeleton";
import ColumnPicker, { useStoredColumns } from "./ColumnPicker";

// Laid out like Traccar's Trips report: pick a vehicle and a period, then
// one row per trip — when it ran, how far, how fast, how long.

type ColumnKey = "start" | "end" | "duration" | "distance" | "avgSpeed" | "purpose" | "fuel" | "endedBy";

const COLUMNS: { key: ColumnKey; label: string; essential?: boolean }[] = [
  { key: "start", label: "Start", essential: true },
  { key: "end", label: "End", essential: true },
  { key: "duration", label: "Duration", essential: true },
  { key: "distance", label: "Distance", essential: true },
  { key: "avgSpeed", label: "Avg speed", essential: true },
  { key: "purpose", label: "Type", essential: true },
  { key: "fuel", label: "Fuel (est.)" },
  { key: "endedBy", label: "Ended by" },
];
const ALL_KEYS = COLUMNS.map((c) => c.key);
const DEFAULT_KEYS = COLUMNS.filter((c) => c.essential).map((c) => c.key);

type Period = "today" | "yesterday" | "week" | "7days" | "month" | "custom";
const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "7days", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// [from, to) for a preset, in the viewer's local time.
function periodRange(period: Period, customFrom: string, customTo: string): [Date, Date] {
  const today = startOfDay(new Date());
  const day = 86400000;
  switch (period) {
    case "today":
      return [today, new Date(today.getTime() + day)];
    case "yesterday":
      return [new Date(today.getTime() - day), today];
    case "week": {
      const monday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * day);
      return [monday, new Date(today.getTime() + day)];
    }
    case "month":
      return [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getTime() + day)];
    case "custom":
      return [new Date(`${customFrom}T00:00:00`), new Date(new Date(`${customTo}T00:00:00`).getTime() + day)];
    default:
      return [new Date(today.getTime() - 6 * day), new Date(today.getTime() + day)];
  }
}

function durationMs(t: TripRecord) {
  return (t.endTime ? new Date(t.endTime).getTime() : Date.now()) - new Date(t.startTime).getTime();
}

function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function TripsList({ basePath = "/admin/trips" }: { basePath?: string }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [period, setPeriod] = useState<Period>("7days");
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date(Date.now() - 6 * 86400000)));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const [result, setResult] = useState<{ key: string; trips: TripRecord[]; error: string | null } | null>(null);
  const { visible, toggle } = useStoredColumns("fleet:trip-columns", ALL_KEYS, DEFAULT_KEYS);

  useEffect(() => {
    apiRequest<VehicleRecord[]>("/api/vehicles").then(setVehicles).catch(() => {});
  }, []);

  const customInvalid = period === "custom" && customFrom > customTo;
  const [from, to] = periodRange(period, customFrom, customTo);
  const query = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}${
    vehicleId ? `&vehicleId=${vehicleId}` : ""
  }`;

  useEffect(() => {
    if (customInvalid) return;
    let cancelled = false;
    apiRequest<TripRecord[]>(`/api/trips?${query}`)
      .then((trips) => !cancelled && setResult({ key: query, trips, error: null }))
      .catch((err) => !cancelled && setResult({ key: query, trips: [], error: errorMessage(err, "Failed to load trips") }));
    return () => {
      cancelled = true;
    };
  }, [query, customInvalid]);

  const loading = !customInvalid && result?.key !== query;
  const trips = result?.trips ?? [];
  const columns = COLUMNS.filter((c) => visible.includes(c.key));

  const totalKm = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
  const totalMs = trips.reduce((sum, t) => sum + durationMs(t), 0);

  function cell(t: TripRecord, key: ColumnKey) {
    switch (key) {
      case "start":
        return formatTime(t.startTime);
      case "end":
        return t.endTime ? (
          formatTime(t.endTime)
        ) : (
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs text-teal-600">In progress</span>
        );
      case "duration":
        return formatDuration(durationMs(t));
      case "distance":
        return t.distanceKm ? `${t.distanceKm.toFixed(1)} km` : "—";
      case "avgSpeed": {
        const hours = durationMs(t) / 3600000;
        return t.endTime && t.distanceKm && hours > 0 ? `${Math.round(t.distanceKm / hours)} km/h` : "—";
      }
      case "purpose":
        return t.purpose ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium capitalize text-blue-700">{t.purpose}</span>
        ) : (
          "—"
        );
      case "fuel": {
        // Only when the vehicle's real mileage is known — a default rate
        // would present a guess as if it were measured.
        const f =
          t.distanceKm && t.vehicleId?.avgConsumptionLPer100Km != null
            ? estimateFuelRangeLiters(t.distanceKm, t.vehicleId.avgConsumptionLPer100Km)
            : null;
        return f ? `${f.min.toFixed(1)}–${f.max.toFixed(1)} L` : "—";
      }
      case "endedBy":
        return !t.endTime ? "—" : t.endedBy === "driver" ? "Driver" : "Automatic";
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar — vehicle, period, columns */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white px-5 py-4 shadow-sm ring-1 ring-black/5">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Vehicle</label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-600"
          >
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v._id} value={v._id}>
                {v.plateNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-600"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {period === "custom" && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => e.target.value && setCustomTo(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-teal-600"
              />
            </div>
          </>
        )}
        <ColumnPicker columns={COLUMNS} visible={visible} onToggle={toggle} />
        {customInvalid && <p className="w-full text-xs text-red-600">The start date must be before the end date.</p>}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        {!customInvalid && !loading && !result?.error && (
          <p className="px-5 pt-4 text-xs text-teal-600">
            {trips.length} {trips.length === 1 ? "trip" : "trips"} · {totalKm.toFixed(1)} km · {formatDuration(totalMs)} on the road
          </p>
        )}
        {loading && !result && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {result?.error && !loading && <p className="p-5 text-sm text-red-600">{result.error}</p>}
        {result && !result.error && (
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="mt-2 w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Vehicle</th>
                  {columns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-4 py-3 text-left font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium">Replay</th>
                </tr>
              </thead>
              <tbody>
                {trips.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-5 py-8 text-center text-gray-400">
                      No trips in this period.
                    </td>
                  </tr>
                ) : (
                  trips.map((t) => (
                    <tr key={t._id} className="border-t border-gray-100 hover:bg-gray-50/60">
                      <td className="px-5 py-3 text-xs font-bold text-teal-600">
                        <Link href={`${basePath}/${t._id}`} className="hover:underline">
                          {t.vehicleId?.plateNumber || "View trip"}
                        </Link>
                      </td>
                      {columns.map((c) => (
                        <td key={c.key} className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {cell(t, c.key)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <Link
                          href={`${basePath}/${t._id}`}
                          className="inline-flex items-center gap-1.5 rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600"
                        >
                          <FaRoute size={12} />
                          Replay
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
