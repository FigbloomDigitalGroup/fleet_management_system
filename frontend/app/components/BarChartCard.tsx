"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

const titleSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-[15px]",
};

export default function BarChartCard({
  title,
  description,
  data,
  dataKey,
  color = "#e16d00",
  size = "md",
}: {
  title: string;
  description?: string;
  data: { name: string; [key: string]: string | number }[];
  dataKey: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const seriesLabel = dataKey.charAt(0).toUpperCase() + dataKey.slice(1);

  return (
    // A column so the chart grows into any extra height when the card is
    // stretched beside a taller one; 200px tall otherwise.
    <div className="flex flex-col rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4">
        <h3 className={`${titleSizes[size]} font-semibold text-gray-900`}>{title}</h3>
        {description && <p className="text-xs text-teal-600 mt-0.5">{description}</p>}
      </div>
      <div className="min-h-[200px] flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="35%">
          <CartesianGrid stroke="#f1f3f5" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          <Tooltip
            cursor={false}
            contentStyle={{ borderRadius: 8, border: "1px solid #eef0f3", fontSize: 12 }}
            formatter={((value: number) => [value, seriesLabel]) as any}
          />
          {/* Pale full-height track behind each bar, in the bar's own color */}
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
            background={{ fill: `${color}1a`, radius: 6 } as any}
          />
        </BarChart>
      </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
          {seriesLabel}
        </span>
      </div>
    </div>
  );
}
