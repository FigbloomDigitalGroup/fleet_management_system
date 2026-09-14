"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const titleSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export default function BarChartCard({
  title,
  data,
  dataKey,
  color = "#ea580c",
  size = "md",
}: {
  title: string;
  data: { name: string; [key: string]: string | number }[];
  dataKey: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="bg-white rounded-lg p-5">
      <h3 className={`${titleSizes[size]} font-bold text-blue-950 mb-4`}>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <Bar dataKey={dataKey} fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}