export default function CircleStat({
  percentage,
  label,
  description,
  color = "#0e4f27",
}: {
  percentage: number;
  label: string;
  description?: string;
  color?: string;
}) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="bg-white rounded-lg p-5 h-full flex flex-col items-center justify-center shadow-sm ring-1 ring-black/5">
      <svg width="150" height="150" viewBox="0 0 100 100" aria-label={`${percentage}% ${label}`}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f3f5" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        {/* Big colored figure, like the percentage stats in the reference design */}
        <text className="font-figures" x="50" y="57" textAnchor="middle" fontSize="20" fontWeight="700" fill={color}>
          {percentage}%
        </text>
      </svg>
      <p className="text-sm font-semibold text-gray-900 mt-2">{label}</p>
      {description && <p className="text-xs text-teal-600 mt-0.5 text-center">{description}</p>}
    </div>
  );
}
