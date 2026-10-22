"use client";

import DistanceFuelChart from "./DistanceFuelChart";

interface DailyPoint {
  date: string;
  distanceKm: number;
  fuelConsumedLiters: number;
}

// Sits right alongside the map preview — compares distance covered vs. fuel
// consumed over the last 7 days. dailyStats is a real, fetched series
// (from /api/companies/me/stats/daily), not hardcoded here.
export default function MapMetricsCard({
  active,
  total,
  dailyStats,
}: {
  active: number;
  total: number;
  dailyStats: DailyPoint[];
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900">Fleet on the map</h2>
        <p className="mt-0.5 text-xs text-teal-600">
          {active} of {total} vehicles active right now
        </p>
      </div>
      <div className="flex-1">
        <DistanceFuelChart data={dailyStats} />
      </div>
    </div>
  );
}
