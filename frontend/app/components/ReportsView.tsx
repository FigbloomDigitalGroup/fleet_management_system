"use client";

import { useCallback, useEffect, useState } from "react";
import { FiDownload, FiPrinter } from "react-icons/fi";
import { apiDownload, apiRequest, errorMessage } from "../lib/api";
import { formatKes } from "../lib/pricing";
import { toDateInput } from "../lib/dateKeys";
import { ReportRow, ReportSummary } from "../types/auth";
import Skeleton from "./Skeleton";
import { scoreBadgeClass } from "./DriverScoreCard";
import ColumnPicker, { useStoredColumns } from "./ColumnPicker";

type NumericKey = Exclude<keyof ReportRow, "id" | "name">;

// `essential` columns show by default; the rest are one click away in the
// Columns picker (like Traccar's report column selector). The Excel export
// always includes every column.
const COLUMNS: { key: NumericKey; label: string; format?: (n: number) => string; driverOnly?: boolean; essential?: boolean }[] = [
  { key: "trips", label: "Trips", essential: true },
  { key: "distanceKm", label: "Distance (km)", format: (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 }), essential: true },
  { key: "drivingHours", label: "Driving (h)", format: (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 }), essential: true },
  { key: "idleMinutes", label: "Idle (min)", format: (n) => Math.round(n).toLocaleString(), essential: true },
  { key: "stops", label: "Stops" },
  { key: "jobsCompleted", label: "Jobs done", essential: true },
  { key: "jobsLate", label: "Jobs late" },
  { key: "jobsFailed", label: "Jobs failed" },
  { key: "expensesKes", label: "Expenses", format: (n) => formatKes(n), essential: true },
  { key: "inspections", label: "Inspections" },
  { key: "inspectionsFailed", label: "Insp. failed" },
  { key: "score", label: "Score", driverOnly: true, essential: true },
];

const COLUMNS_STORAGE_KEY = "fleet:report-columns";
const ALL_KEYS = COLUMNS.map((c) => c.key);
const DEFAULT_KEYS = COLUMNS.filter((c) => c.essential).map((c) => c.key);

const MAX_DAYS = 93;

// The date inputs are whole days: from the start of "from" to the end of "to".
function rangeQuery(from: string, to: string, groupBy: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  return `from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}&groupBy=${groupBy}`;
}

export default function ReportsView() {
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [groupBy, setGroupBy] = useState<"vehicle" | "driver">("vehicle");
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { visible: visibleColumns, toggle: toggleColumn } = useStoredColumns(COLUMNS_STORAGE_KEY, ALL_KEYS, DEFAULT_KEYS);

  const rangeError =
    from > to
      ? "The start date must be before the end date."
      : (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1 > MAX_DAYS
        ? `Pick a range of ${MAX_DAYS} days or less.`
        : null;

  const load = useCallback(async () => {
    if (rangeError) return;
    setLoading(true);
    try {
      const data = await apiRequest<ReportSummary>(`/api/reports/summary?${rangeQuery(from, to, groupBy)}`);
      setReport(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load report"));
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy, rangeError]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadExcel() {
    setDownloading(true);
    setDownloadError(null);
    try {
      await apiDownload(`/api/reports/summary.xlsx?${rangeQuery(from, to, groupBy)}`, `fleet-report-${groupBy}-${from}-to-${to}.xlsx`);
    } catch (err) {
      setDownloadError(errorMessage(err, "Download failed"));
    } finally {
      setDownloading(false);
    }
  }

  const availableColumns = COLUMNS.filter((c) => !c.driverOnly || groupBy === "driver");
  const columns = availableColumns.filter((c) => visibleColumns.includes(c.key));
  const cell = (key: NumericKey, value: number | null | undefined) => {
    if (value == null) return "—";
    const col = COLUMNS.find((c) => c.key === key);
    return col?.format ? col.format(value) : value.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Controls — not part of the printed report */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white px-5 py-4 shadow-sm ring-1 ring-black/5 print:hidden">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-teal-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-teal-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Group by</label>
          <div className="flex rounded border border-gray-300 text-sm">
            {(["vehicle", "driver"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1.5 capitalize ${groupBy === g ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <ColumnPicker columns={availableColumns} visible={visibleColumns} onToggle={toggleColumn} />
        <div className="ml-auto flex gap-2">
          <button
            onClick={downloadExcel}
            disabled={downloading || !!rangeError}
            className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <FiDownload size={14} />
            {downloading ? "Preparing…" : "Export Excel"}
          </button>
          <button
            onClick={() => window.print()}
            disabled={!report || loading}
            className="inline-flex items-center gap-1.5 rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <FiPrinter size={14} />
            Export PDF
          </button>
        </div>
        {(rangeError || downloadError) && <p className="w-full text-xs text-red-600">{rangeError || downloadError}</p>}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 print:shadow-none print:ring-0">
        {/* Heading only matters on paper — on screen the hero banner says it */}
        <div className="hidden px-5 pt-4 print:block">
          <h1 className="text-lg font-bold text-blue-950">FIGBLOOM FLEET — fleet report by {groupBy}</h1>
          <p className="text-xs text-gray-600">
            {new Date(`${from}T00:00:00`).toLocaleDateString()} – {new Date(`${to}T00:00:00`).toLocaleDateString()} · printed{" "}
            {new Date().toLocaleString()}
          </p>
        </div>

        {loading && !report && <Skeleton rows={6} rowClassName="h-10" className="p-5" />}
        {error && <p className="p-5 text-sm text-red-600">{error}</p>}
        {report && !error && (
          <div className={`overflow-x-auto print:overflow-visible ${loading ? "opacity-60" : ""}`}>
            <p className="px-5 pt-4 text-xs text-teal-600 print:hidden">
              Stops and idle time are measured inside recorded trips. Scores need at least 10 km of driving.
            </p>
            <table className="mt-2 w-full text-sm print:text-[10px]">
              <thead className="bg-gray-50 text-xs uppercase text-black">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">{groupBy === "driver" ? "Driver" : "Vehicle"}</th>
                  {columns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-3 text-right font-bold">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-5 py-8 text-center text-gray-400">
                      Nothing to report for this range.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 print:break-inside-avoid">
                      <td className="px-4 py-2.5 font-medium text-blue-950">{row.name}</td>
                      {columns.map((c) =>
                        c.key === "score" ? (
                          <td key={c.key} className="px-3 py-2.5 text-right">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${scoreBadgeClass(row.score)}`}>
                              {row.score == null ? "—" : Math.round(row.score)}
                            </span>
                          </td>
                        ) : (
                          <td
                            key={c.key}
                            className={`whitespace-nowrap px-3 py-2.5 text-right ${
                              (c.key === "jobsLate" || c.key === "inspectionsFailed") && row[c.key]
                                ? "font-medium text-orange-600"
                                : c.key === "jobsFailed" && row[c.key]
                                  ? "font-medium text-red-600"
                                  : "text-gray-700"
                            }`}
                          >
                            {cell(c.key, row[c.key])}
                          </td>
                        )
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {report.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="px-4 py-3 text-blue-950">Total</td>
                    {columns.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-3 text-right text-blue-950">
                        {c.key === "score" ? "" : cell(c.key, report.totals[c.key] as number | undefined)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
