"use client";

import DistanceFuelChart from "./DistanceFuelChart";

interface DailyPoint {
  date: string;
  distanceKm: number;
  fuelConsumedLiters: number;
}

// Distance covered vs. fuel used over the last 7 days, from
// /api/companies/me/stats/daily.
export default function MapMetricsCard({ dailyStats }: { dailyStats: DailyPoint[] }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900">Distance and fuel: last 7 days</h2>
        <p className="mt-0.5 text-xs text-teal-600">Kilometres driven and litres of fuel used each day</p>
      </div>
      <div className="flex-1">
        <DistanceFuelChart data={dailyStats} />
      </div>
    </div>
  );
}
