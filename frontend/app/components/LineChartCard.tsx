"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const titleSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export default function LineChartCard({
  title,
  description,
  data,
  lines,
  size = "md",
}: {
  title: string;
  description?: string;
  data: { name: string; [key: string]: string | number }[];
  lines: { dataKey: string; label: string; color: string }[];
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className={`${titleSizes[size]} font-bold text-blue-950`}>{title}</h3>
          {description && <p className="text-xs text-teal-600 mt-0.5">{description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {lines.map((line) => (
            <span
              key={line.dataKey}
              className="flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: line.color }} aria-hidden="true" />
              {line.label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              strokeWidth={2.5}
              dot={{ r: 4, fill: line.color, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
