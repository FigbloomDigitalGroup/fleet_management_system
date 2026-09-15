"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
  description,
  data,
  size = "md",
}: {
  title: string;
  description?: string;
  data: DonutSlice[];
  size?: "sm" | "md" | "lg";
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4">
        <h3 className={`${titleSizes[size]} font-bold text-blue-950`}>{title}</h3>
        {description && <p className="text-xs text-teal-600 mt-0.5">{description}</p>}
      </div>
      <div className="relative flex-1">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={3}
              cornerRadius={6}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((slice, i) => (
                <Cell key={i} fill={slice.color} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total, overlaid on the donut hole */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-400">total</p>
          </div>
        </div>
      </div>

      {/* Legend, as a wrapping row below the donut */}
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data.map((slice) => (
          <span key={slice.name} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.color }} aria-hidden="true" />
            {slice.name}
          </span>
        ))}
      </div>
    </div>
  );
}