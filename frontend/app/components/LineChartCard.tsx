"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

const titleSizes = {
  sm: "text-xs",
  md: "text-[15px]",
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
  const labels = Object.fromEntries(lines.map((l) => [l.dataKey, l.label]));

  return (
    <div className="flex h-full flex-col rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4">
        <h3 className={`${titleSizes[size]} font-semibold text-gray-900`}>{title}</h3>
        {description && <p className="text-xs text-teal-600 mt-0.5">{description}</p>}
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid stroke="#f1f3f5" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #eef0f3", fontSize: 12 }}
              formatter={((value: number, key: string) => [value, labels[key] ?? key]) as any}
            />
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="linear"
                dataKey={line.dataKey}
                stroke={line.color}
                strokeWidth={1.75}
                dot={{ r: 3, fill: line.color, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {lines.map((line) => (
          <span key={line.dataKey} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="h-2 w-2 rounded-full" style={{ background: line.color }} aria-hidden="true" />
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
}
