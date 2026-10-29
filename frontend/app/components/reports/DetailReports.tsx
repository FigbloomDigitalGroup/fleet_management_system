"use client";

import { ReactNode } from "react";
import { formatKes } from "../../lib/pricing";
import { alertTypeLabel } from "../../lib/alertTypes";
import { FuelReport, GeofenceReport, MaintenanceReport, SafetyKey, SafetyReport, TripsReport } from "../../types/reports";

// The detail reports under the Reports page's tabs. Plain tables in the
// summary table's style, so they print and read the same way.

const km = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 1 }));
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const duration = (minutes: number | null) => {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

type Col = { label: string; align?: "left" | "right" };

function Table({ cols, children, footer, empty }: { cols: Col[]; children: ReactNode; footer?: ReactNode; empty?: string | null }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-sm print:text-[10px]">
        <thead className="bg-gray-50 text-xs uppercase text-black">
          <tr>
            {cols.map((c, i) => (
              <th key={c.label} className={`whitespace-nowrap px-3 py-3 font-bold ${i === 0 ? "pl-4" : ""} ${c.align === "right" ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={cols.length} className="px-5 py-8 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
        {!empty && footer}
      </table>
    </div>
  );
}

const td = "whitespace-nowrap px-3 py-2.5 text-gray-700";
const tdR = `${td} text-right`;
const tdFirst = "px-4 py-2.5 font-medium text-blue-950";
const tfRow = "border-t-2 border-gray-300 bg-gray-50 font-bold text-blue-950";

function Note({ children }: { children: ReactNode }) {
  return <p className="px-5 pt-4 text-xs text-teal-600 print:hidden">{children}</p>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="px-5 pb-2 pt-5 text-sm font-semibold text-gray-900">{children}</h3>;
}

export function FuelTable({ report }: { report: FuelReport }) {
  return (
    <>
      <Note>
        Estimated litres = distance × the vehicle&apos;s rated consumption (set on each vehicle). Fuel bought comes from
        expenses logged as fuel.
      </Note>
      <Table
        cols={[
          { label: "Vehicle" },
          { label: "Distance (km)", align: "right" },
          { label: "Rated L/100 km", align: "right" },
          { label: "Est. litres", align: "right" },
          { label: "Fuel bought", align: "right" },
          { label: "Fill-ups", align: "right" },
          { label: "KES / km", align: "right" },
        ]}
        empty={report.rows.length ? null : "No vehicles yet."}
        footer={
          <tfoot>
            <tr className={tfRow}>
              <td className="px-4 py-3">Total</td>
              <td className="px-3 py-3 text-right">{km(report.totals.distanceKm)}</td>
              <td />
              <td className="px-3 py-3 text-right">{km(report.totals.estimatedLiters)}</td>
              <td className="px-3 py-3 text-right">{formatKes(report.totals.fuelKes)}</td>
              <td className="px-3 py-3 text-right">{report.totals.fills}</td>
              <td className="px-3 py-3 text-right">{km(report.totals.kesPerKm)}</td>
            </tr>
          </tfoot>
        }
      >
        {report.rows.map((r) => (
          <tr key={r.id} className="border-t border-gray-100 print:break-inside-avoid">
            <td className={tdFirst}>{r.name}</td>
            <td className={tdR}>{km(r.distanceKm)}</td>
            <td className={tdR}>{r.ratedLPer100Km == null ? <span className="text-orange-600">Check setting</span> : km(r.ratedLPer100Km)}</td>
            <td className={tdR}>{km(r.estimatedLiters)}</td>
            <td className={tdR}>{r.fuelKes ? formatKes(r.fuelKes) : "—"}</td>
            <td className={tdR}>{r.fills || "—"}</td>
            <td className={tdR}>{km(r.kesPerKm)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

const SAFETY_COLS: { key: SafetyKey; label: string }[] = [
  { key: "speeding", label: "Speeding" },
  { key: "harsh_braking", label: "Harsh braking" },
  { key: "harsh_acceleration", label: "Harsh accel." },
  { key: "harsh_cornering", label: "Harsh cornering" },
  { key: "phone_use", label: "Phone use" },
];

export function SafetyTable({ report }: { report: SafetyReport }) {
  const byDriver = report.groupBy === "driver";
  return (
    <>
      <Note>Speeding and harsh driving come from each trip&apos;s GPS and the driver app&apos;s motion sensors.</Note>
      <Table
        cols={[
          { label: byDriver ? "Driver" : "Vehicle" },
          ...SAFETY_COLS.map((c) => ({ label: c.label, align: "right" as const })),
          { label: "Top speed", align: "right" },
          { label: "Total", align: "right" },
        ]}
        empty={report.rows.length ? null : `No ${byDriver ? "drivers" : "vehicles"} yet.`}
        footer={
          <tfoot>
            <tr className={tfRow}>
              <td className="px-4 py-3">Total</td>
              {SAFETY_COLS.map((c) => (
                <td key={c.key} className="px-3 py-3 text-right">
                  {report.totals[c.key]}
                </td>
              ))}
              <td className="px-3 py-3 text-right">{report.totals.topSpeedKph == null ? "—" : `${report.totals.topSpeedKph} km/h`}</td>
              <td className="px-3 py-3 text-right">{report.totals.total}</td>
            </tr>
          </tfoot>
        }
      >
        {report.rows.map((r) => (
          <tr key={r.id} className="border-t border-gray-100 print:break-inside-avoid">
            <td className={tdFirst}>{r.name}</td>
            {SAFETY_COLS.map((c) => (
              <td key={c.key} className={`${tdR} ${r[c.key] ? (c.key === "speeding" ? "font-medium text-red-600" : "font-medium text-orange-600") : ""}`}>
                {r[c.key] || "—"}
              </td>
            ))}
            <td className={tdR}>{r.topSpeedKph == null ? "—" : `${r.topSpeedKph} km/h`}</td>
            <td className={`${tdR} font-semibold`}>{r.total || "—"}</td>
          </tr>
        ))}
      </Table>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          <SectionTitle>Alerts raised in this period</SectionTitle>
          {report.alertsByType.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-400">No alerts in this period.</p>
          ) : (
            <ul className="px-5 pb-5">
              {report.alertsByType.map((a) => {
                const max = report.alertsByType[0].count;
                return (
                  <li key={a.type} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="w-44 shrink-0 truncate text-gray-700">{alertTypeLabel(a.type)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-orange-500" style={{ width: `${(a.count / max) * 100}%` }} />
                    </span>
                    <span className="w-10 text-right font-medium text-blue-950">{a.count}</span>
                  </li>
                );
              })}
              <li className="pt-2 text-xs text-gray-400">Resolved alerts are cleared after 30 minutes, so older ones may not be counted.</li>
            </ul>
          )}
        </div>
        <div>
          <SectionTitle>Latest speeding</SectionTitle>
          {report.speeding.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-400">No speeding in this period. 🎉</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto px-5 pb-5 print:max-h-none">
              {report.speeding.slice(0, 50).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 border-b border-gray-50 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-gray-700">
                    <span className="font-medium text-blue-950">{e.vehicle}</span> · {e.driver}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">{when(e.recordedAt)}</span>
                  <span className="w-20 shrink-0 text-right font-semibold text-red-600">{e.speedKph ?? "—"} km/h</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export function GeofenceTable({ report }: { report: GeofenceReport }) {
  return (
    <>
      <Note>
        {report.recordedSince
          ? `Geofence history is kept from ${new Date(report.recordedSince).toLocaleDateString()} onward.`
          : "Geofence entries and exits are recorded from now on — they'll appear here as vehicles cross your zones."}
      </Note>
      {report.zones.length > 0 && (
        <>
          <SectionTitle>By geofence</SectionTitle>
          <Table
            cols={[{ label: "Geofence" }, { label: "Entries", align: "right" }, { label: "Exits", align: "right" }, { label: "Vehicles", align: "right" }]}
          >
            {report.zones.map((z) => (
              <tr key={z.geofence} className="border-t border-gray-100">
                <td className={tdFirst}>{z.geofence}</td>
                <td className={tdR}>{z.entries}</td>
                <td className={tdR}>{z.exits}</td>
                <td className={tdR}>{z.vehicles}</td>
              </tr>
            ))}
          </Table>
          <SectionTitle>Visits</SectionTitle>
        </>
      )}
      <Table
        cols={[
          { label: "Geofence" },
          { label: "Vehicle" },
          { label: "Driver" },
          { label: "Entered" },
          { label: "Exited" },
          { label: "Time inside", align: "right" },
        ]}
        empty={report.visits.length ? null : "No geofence entries or exits in this period."}
      >
        {report.visits.map((v) => (
          <tr key={v.id} className="border-t border-gray-100 print:break-inside-avoid">
            <td className={tdFirst}>{v.geofence}</td>
            <td className={td}>{v.vehicle}</td>
            <td className={td}>{v.driver}</td>
            <td className={td}>{v.enteredAt ? when(v.enteredAt) : <span className="text-gray-400">Before period</span>}</td>
            <td className={td}>{v.exitedAt ? when(v.exitedAt) : <span className="font-medium text-teal-600">Still inside</span>}</td>
            <td className={tdR}>{duration(v.minutesInside)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

const STATE_BADGE: Record<MaintenanceReport["rows"][number]["state"], { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-red-50 text-red-600 border-red-200" },
  due_soon: { label: "Due soon", cls: "bg-orange-50 text-orange-600 border-orange-200" },
  upcoming: { label: "Upcoming", cls: "bg-gray-50 text-gray-600 border-gray-200" },
};

export function MaintenanceTable({ report }: { report: MaintenanceReport }) {
  const t = report.totals;
  return (
    <>
      <Note>
        Open service reminders across the fleet (not limited to the dates above). {t.servicedInRange} service
        {t.servicedInRange === 1 ? "" : "s"} done in this period{t.serviceCostKes ? `, costing ${formatKes(t.serviceCostKes)}` : ""}.
      </Note>
      <div className="flex flex-wrap gap-2 px-5 pt-3">
        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">{t.overdue} overdue</span>
        <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600">{t.dueSoon} due soon</span>
        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">{t.upcoming} upcoming</span>
      </div>
      <div className="mt-3">
        <Table
          cols={[
            { label: "Vehicle" },
            { label: "Service" },
            { label: "Status" },
            { label: "Due date", align: "right" },
            { label: "Due at", align: "right" },
            { label: "Odometer", align: "right" },
          ]}
          empty={report.rows.length ? null : "No open service reminders. Add them on each vehicle's Maintenance tab."}
        >
          {report.rows.map((r) => (
            <tr key={r.id} className="border-t border-gray-100 print:break-inside-avoid">
              <td className={tdFirst}>{r.vehicle}</td>
              <td className={td}>{r.title}</td>
              <td className={td}>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATE_BADGE[r.state].cls}`}>{STATE_BADGE[r.state].label}</span>
              </td>
              <td className={tdR}>
                {r.dueDate ? (
                  <>
                    {new Date(r.dueDate).toLocaleDateString()}
                    <span className="block text-xs text-gray-400">
                      {r.daysLeft == null ? "" : r.daysLeft < 0 ? `${-r.daysLeft} days late` : `in ${r.daysLeft} days`}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className={tdR}>
                {r.dueOdometerKm == null ? (
                  "—"
                ) : (
                  <>
                    {km(r.dueOdometerKm)} km
                    <span className="block text-xs text-gray-400">
                      {r.kmLeft == null ? "" : r.kmLeft < 0 ? `${km(-r.kmLeft)} km over` : `${km(r.kmLeft)} km to go`}
                    </span>
                  </>
                )}
              </td>
              <td className={tdR}>{km(r.odometerKm)} km</td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}

export function TripsTable({ report }: { report: TripsReport }) {
  return (
    <>
      <Note>
        Every trip that started in this period, newest first.
        {report.truncated ? " Showing the latest 1,000 — pick a shorter range or export to Excel for all." : ""}
      </Note>
      <Table
        cols={[
          { label: "Vehicle" },
          { label: "Driver" },
          { label: "Start" },
          { label: "End" },
          { label: "Duration", align: "right" },
          { label: "Distance (km)", align: "right" },
          { label: "Avg speed", align: "right" },
          { label: "Purpose" },
        ]}
        empty={report.rows.length ? null : "No trips in this period."}
        footer={
          <tfoot>
            <tr className={tfRow}>
              <td className="px-4 py-3">Total</td>
              <td className="px-3 py-3">{report.totals.trips} trips</td>
              <td />
              <td />
              <td className="px-3 py-3 text-right">{duration(report.totals.minutes)}</td>
              <td className="px-3 py-3 text-right">{km(report.totals.distanceKm)}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        }
      >
        {report.rows.map((r) => (
          <tr key={r.id} className="border-t border-gray-100 print:break-inside-avoid">
            <td className={tdFirst}>{r.vehicle}</td>
            <td className={td}>{r.driver}</td>
            <td className={td}>{when(r.startTime)}</td>
            <td className={td}>{r.endTime ? when(r.endTime) : <span className="font-medium text-teal-600">In progress</span>}</td>
            <td className={tdR}>{duration(r.minutes)}</td>
            <td className={tdR}>{km(r.distanceKm)}</td>
            <td className={tdR}>{r.avgSpeedKph == null ? "—" : `${r.avgSpeedKph} km/h`}</td>
            <td className={`${td} capitalize`}>{r.purpose ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
