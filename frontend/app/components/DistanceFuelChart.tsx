"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

interface DailyPoint {
  date: string;
  distanceKm: number;
  fuelConsumedLiters: number;
}

function dayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: "short" });
}

// Distance and fuel are different units, so they each get their own Y axis
// (left = km, right = L) instead of sharing one scale, which would make
// whichever number is naturally larger drown out the other.
export default function DistanceFuelChart({ data }: { data: DailyPoint[] }) {
  const chartData = data.map((d) => ({ name: dayLabel(d.date), distanceKm: d.distanceKm, fuelConsumedLiters: d.fuelConsumedLiters }));

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height={185}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="distanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fuelFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fb923c" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f1f3f5" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="distance" hide />
          <YAxis yAxisId="fuel" orientation="right" hide />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
            formatter={((value: number, key: string) =>
              key === "distanceKm" ? [`${value} km`, "Distance"] : [`${value} L`, "Fuel consumed"]) as any}
          />
          <Area
            yAxisId="distance"
            type="monotone"
            dataKey="distanceKm"
            stroke="#2dd4bf"
            strokeWidth={1.75}
            fill="url(#distanceFill)"
            dot={{ r: 3, fill: "#2dd4bf", strokeWidth: 0 }}
          />
          <Area
            yAxisId="fuel"
            type="monotone"
            dataKey="fuelConsumedLiters"
            stroke="#fb923c"
            strokeWidth={1.75}
            fill="url(#fuelFill)"
            dot={{ r: 3, fill: "#fb923c", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden="true" />
          Distance (km)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden="true" />
          Fuel consumed (L)
        </span>
      </div>
    </div>
  );
}
