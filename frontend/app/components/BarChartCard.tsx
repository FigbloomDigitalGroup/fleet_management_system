"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const titleSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export default function BarChartCard({
  title,
  description,
  data,
  dataKey,
  color = "#ea580c",
  size = "md",
}: {
  title: string;
  description?: string;
  data: { name: string; [key: string]: string | number }[];
  dataKey: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className={`${titleSizes[size]} font-bold text-blue-950`}>{title}</h3>
          {description && <p className="text-xs text-teal-600 mt-0.5">{description}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
          {dataKey.charAt(0).toUpperCase() + dataKey.slice(1)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}