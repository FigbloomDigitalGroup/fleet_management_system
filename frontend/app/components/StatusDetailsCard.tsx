interface StatusItem {
  label: string;
  value: number;
  color: string;
  description: string;
}

export default function StatusDetailsCard({ items, title = "Breakdown" }: { items: StatusItem[]; title?: string }) {
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="bg-white rounded-lg p-5 flex-1 shadow-sm ring-1 ring-black/5">
      <h3 className="text-sm font-bold text-blue-950">{title}</h3>
      <p className="text-xs text-teal-600 mt-0.5 mb-4">Share of the total for each status</p>
      <div className="space-y-4">
        {items.map((item) => {
          const pct = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {item.value} <span className="text-gray-400 font-normal">({pct}%)</span>
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden mb-1">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
              </div>
              <p className="text-xs text-teal-600 pl-4">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}