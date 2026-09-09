export default function CircleStat({
  percentage,
  label,
  color = "#16a34a",
}: {
  percentage: number;
  label: string;
  color?: string;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white rounded-lg p-5 h-full flex flex-col items-center justify-center">
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
    </div>
  );
}