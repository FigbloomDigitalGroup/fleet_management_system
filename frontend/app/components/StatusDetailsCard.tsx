interface StatusItem {
  label: string;
  value: number;
  color: string;
  description: string;
}

export default function StatusDetailsCard({ items }: { items: StatusItem[] }) {
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="bg-white rounded-lg p-5 flex-1">
      <h3 className="text-sm font-bold text-blue-950 mb-4">Breakdown</h3>
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
              <div className="w-full h-3 bg-gray-100 overflow-hidden mb-1">
                <div className="h-full" style={{ width: `${pct}%`, background: item.color }} />
              </div>
              <p className="text-xs text-gray-400 pl-4">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}