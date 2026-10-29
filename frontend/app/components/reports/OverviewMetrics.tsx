"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { ReportOverview } from "../../types/reports";
import ReportMetrics from "./ReportMetrics";
import Skeleton from "../Skeleton";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

// Top of the Overview page: the headline metrics with their graphs and the
// top drivers, for the last 7 or 30 days. `basePath` is "/company" or
// "/admin" — where the driver links point.
export default function OverviewMetrics({ basePath }: { basePath: string }) {
  const [days, setDays] = useState(7);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    apiRequest<ReportOverview>(`/api/reports/overview?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then((o) => {
        if (cancelled) return;
        setOverview(o);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [days]);

  // The rest of the Overview still works without these cards.
  if (failed && !overview) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Fleet at a glance</h2>
        <div className="flex rounded border border-gray-300 bg-white text-xs" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              aria-pressed={days === p.days}
              className={`px-2.5 py-1 ${days === p.days ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {overview ? <ReportMetrics overview={overview} basePath={basePath} /> : <Skeleton rows={1} rowClassName="h-44" />}
    </section>
  );
}
