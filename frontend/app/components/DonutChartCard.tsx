"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

const titleSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export default function DonutChartCard({
  title,
  data,
  size = "md",
}: {
  title: string;
  data: DonutSlice[];
  size?: "sm" | "md" | "lg";
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex h-full flex-col bg-white rounded-lg p-5">
      <h3 className={`${titleSizes[size]} font-bold text-blue-950 mb-4`}>{title}</h3>
      <div className="relative flex-1">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((slice, i) => (
                <Cell key={i} fill={slice.color} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: "#6b7280" }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total, overlaid on the donut hole */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginRight: "35%" }}>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-400">total</p>
          </div>
        </div>
      </div>
    </div>
  );
}