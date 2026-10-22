"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

const titleSizes = {
  sm: "text-xs",
  md: "text-[15px]",
  lg: "text-base",
};

// Name + percentage centred inside each slice, like a classic labelled pie.
// Slivers under 8% skip the label (it wouldn't fit); the list beside the pie
// and the tooltip still show them.
function renderSliceLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, name } = props;
  if (!percent || percent < 0.08) return null;
  const RAD = Math.PI / 180;
  const r = outerRadius * (percent > 0.6 ? 0.45 : 0.6);
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} textAnchor="middle" fill="#0f172a" fontSize={12} fontWeight={700}>
      <tspan x={x} dy="-0.2em">{name}</tspan>
      <tspan className="font-figures" x={x} dy="1.25em">{Math.round(percent * 100)}%</tspan>
    </text>
  );
}

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
  const pieData = data.filter((d) => d.value > 0);

  return (
    <div className="flex h-full flex-col rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4">
        <h3 className={`${titleSizes[size]} font-semibold text-gray-900`}>{title}</h3>
        {description && <p className="text-xs text-teal-600 mt-0.5">{description}</p>}
      </div>
      <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row">
        <div className="w-full sm:w-1/2">
          {total === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                {/* Full pie with each slice's name and share written inside it.
                    Empty statuses are left out so they don't draw a label. */}
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  startAngle={90}
                  endAngle={-270}
                  labelLine={false}
                  label={renderSliceLabel}
                  isAnimationActive={false}
                >
                  {pieData.map((slice, i) => (
                    <Cell key={i} fill={slice.color} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #eef0f3", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <p className="mt-1 text-center text-xs text-gray-400">
            <span className="font-figures font-semibold text-gray-900">{total}</span> in total
          </p>
        </div>

        {/* Legend as a list: dot, status, count pill tinted in the slice color */}
        <ul className="w-full divide-y divide-gray-100 sm:w-1/2">
          {data.map((slice) => (
            <li key={slice.name} className="flex items-center justify-between py-2.5">
              <span className="flex items-center gap-2 text-[13px] text-gray-700">
                <span className="h-2 w-2 rounded-full" style={{ background: slice.color }} aria-hidden="true" />
                {slice.name}
              </span>
              <span
                className="font-figures min-w-6 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold"
                style={{ background: `${slice.color}26`, color: slice.color }}
              >
                {slice.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
