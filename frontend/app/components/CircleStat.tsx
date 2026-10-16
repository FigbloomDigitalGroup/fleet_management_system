export default function CircleStat({
  percentage,
  label,
  description,
  color = "#0d9488",
}: {
  percentage: number;
  label: string;
  description?: string;
  color?: string;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-5 h-full flex flex-col items-center justify-center shadow-sm ring-1 ring-black/5">
      <svg width="160" height="160" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="16" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="600" fill="#111827">
          {percentage}%
        </text>
      </svg>
      <p className="text-sm text-gray-600 mt-2">{label}</p>
      {description && <p className="text-xs text-teal-600 mt-0.5 text-center">{description}</p>}
    </div>
  );
}