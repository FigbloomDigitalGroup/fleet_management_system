export default function StatCard({
  label,
  value,
  accent = "green",
}: {
  label: string;
  value: string | number;
  accent?: "green" | "orange";
}) {
  const color = accent === "green" ? "text-green-500" : "text-orange-500";

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}