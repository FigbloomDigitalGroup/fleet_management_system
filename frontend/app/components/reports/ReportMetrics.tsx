"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip } from "recharts";
import { FiArrowDownRight, FiArrowRight, FiArrowUpRight, FiDroplet, FiMap, FiNavigation, FiShield } from "react-icons/fi";
import Avatar from "../Avatar";
import { scoreBadgeClass } from "../DriverScoreCard";
import { formatKes } from "../../lib/pricing";
import { ReportOverview } from "../../types/reports";

// Brand palette (globals.css): teal-600 green, teal-400, orange-500.
const GREEN = "#0e4f27";
const GREEN_SOFT = "#50a86a";
const ORANGE = "#ff8a12";

const shortDay = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const tooltipStyle = { borderRadius: 8, border: "1px solid #eef0f3", fontSize: 12, padding: "6px 10px" };

// "+12% vs previous period". `goodWhenUp` flips the colour for costs, where
// a rise is bad news.
function Change({ change, unit = "%", goodWhenUp = true }: { change: number | null; unit?: string; goodWhenUp?: boolean }) {
  if (change == null) return <span className="text-xs text-gray-400">No earlier data</span>;
  const flat = change === 0;
  const up = change > 0;
  const good = flat ? null : up === goodWhenUp;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
        good == null ? "bg-gray-100 text-gray-600" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
      }`}
    >
      {!flat && (up ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />)}
      {up ? "+" : ""}
      {change.toLocaleString(undefined, { maximumFractionDigits: 1 })}
      {unit}
      <span className="ml-1 font-normal text-gray-500">vs previous</span>
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  change,
  chart,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  change: ReactNode;
  /** null when there's nothing to draw — a short note shows instead. */
  chart: ReactNode | null;
}) {
  return (
    <div className="flex flex-col rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5 print:break-inside-avoid print:shadow-none print:ring-1 print:ring-gray-200">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-600">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-blue-950">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      <div className="mt-2">{change}</div>
      <div className="mt-3 h-16">
        {chart ?? <p className="flex h-full items-center justify-center rounded-md bg-gray-50 text-xs text-gray-400">Nothing recorded in this period</p>}
      </div>
    </div>
  );
}

export default function ReportMetrics({ overview, basePath }: { overview: ReportOverview; basePath: string }) {
  const { metrics, daily, topDrivers, driverCount } = overview;
  const series = daily.map((d) => ({ ...d, label: shortDay(d.date) }));
  const score = metrics.avgScore.value;
  const any = (key: "distanceKm" | "trips" | "expensesKes") => series.some((d) => d[key] > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<FiMap size={15} />}
          label="Total distance"
          value={`${(metrics.distanceKm.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`}
          change={<Change change={metrics.distanceKm.change} />}
          chart={
            !any("distanceKm") ? null : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="km-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN_SOFT} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={GREEN_SOFT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""}
                  formatter={((v: number) => [`${v} km`, "Distance"]) as any}
                />
                <Area type="monotone" dataKey="distanceKm" stroke={GREEN} strokeWidth={2} fill="url(#km-fill)" />
              </AreaChart>
            </ResponsiveContainer>
            )
          }
        />
        <MetricCard
          icon={<FiDroplet size={15} />}
          label="Fuel & expenses"
          value={formatKes(metrics.expensesKes.value ?? 0)}
          sub={`Fuel ${formatKes(metrics.expensesKes.fuelKes)}`}
          change={<Change change={metrics.expensesKes.change} goodWhenUp={false} />}
          chart={
            !any("expensesKes") ? null : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
                <Tooltip
                  cursor={false}
                  contentStyle={tooltipStyle}
                  labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""}
                  formatter={((v: number, name: string) => [formatKes(v), name === "fuelKes" ? "Fuel" : "Other"]) as any}
                />
                <Bar dataKey="fuelKes" stackId="kes" fill={ORANGE} />
                <Bar
                  dataKey={(d: { expensesKes: number; fuelKes: number }) => d.expensesKes - d.fuelKes}
                  name="other"
                  stackId="kes"
                  fill="#ffd2a3"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            )
          }
        />
        <MetricCard
          icon={<FiNavigation size={15} />}
          label="Total trips"
          value={(metrics.trips.value ?? 0).toLocaleString()}
          change={<Change change={metrics.trips.change} />}
          chart={
            !any("trips") ? null : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
                <Tooltip
                  cursor={false}
                  contentStyle={tooltipStyle}
                  labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""}
                  formatter={((v: number) => [v, "Trips"]) as any}
                />
                <Bar dataKey="trips" fill={GREEN} radius={[3, 3, 0, 0]} background={{ fill: `${GREEN}12` } as any} />
              </BarChart>
            </ResponsiveContainer>
            )
          }
        />
        <MetricCard
          icon={<FiShield size={15} />}
          label="Average driver score"
          value={score == null ? "—" : `${score}/100`}
          sub={metrics.avgScore.grade ?? "Drivers need 10 km of driving to be scored"}
          change={<Change change={metrics.avgScore.change} unit=" pts" />}
          chart={
            <div className="flex h-full items-center gap-3">
              <div className="h-16 w-16 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: score ?? 0 }]} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={8} fill={score == null ? "#d1d5db" : score >= 75 ? GREEN : score >= 60 ? ORANGE : "#dc2626"} background={{ fill: "#f1f3f5" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-0.5 text-[11px] text-gray-500">
                {Object.entries(overview.scoreBands)
                  .filter(([, n]) => n > 0)
                  .map(([band, n]) => (
                    <li key={band}>
                      <span className="font-semibold text-gray-700">{n}</span> {band.toLowerCase()}
                    </li>
                  ))}
              </ul>
            </div>
          }
        />
      </div>

      {driverCount > 0 && (
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5 print:hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Top drivers</h3>
              <p className="text-xs text-teal-600">Best safety score for this period</p>
            </div>
            {driverCount > topDrivers.length && (
              <Link
                href={`${basePath}/drivers`}
                className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
              >
                View all {driverCount} drivers <FiArrowRight size={14} />
              </Link>
            )}
          </div>
          <ul className="divide-y divide-gray-100">
            {topDrivers.map((d) => (
              <li key={d.id}>
                <Link href={`${basePath}/drivers/${d.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-gray-50">
                  <Avatar src={d.avatarUrl} name={d.fullName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-blue-950">{d.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {d.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km · {d.trips} trip{d.trips === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${scoreBadgeClass(d.score)}`}>
                    {d.score == null ? "Not scored" : d.score}
                  </span>
                  <FiArrowRight size={14} className="text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
