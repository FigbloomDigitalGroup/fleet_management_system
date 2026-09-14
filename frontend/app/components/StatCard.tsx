import {
  FaBell,
  FaBuilding,
  FaCarSide,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaTools,
  FaUserShield,
  FaUsers,
} from "react-icons/fa";

function getStatIcon(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("vehicle")) return FaCarSide;
  if (normalizedLabel.includes("driver") || normalizedLabel.includes("user")) return FaUsers;
  if (normalizedLabel.includes("admin")) return FaUserShield;
  if (normalizedLabel.includes("company") || normalizedLabel.includes("companies")) return FaBuilding;
  if (normalizedLabel.includes("alert")) return FaBell;
  if (normalizedLabel.includes("pending")) return FaClock;
  if (normalizedLabel.includes("maintenance")) return FaTools;
  if (normalizedLabel.includes("active")) return FaCheckCircle;
  if (normalizedLabel.includes("idle") || normalizedLabel.includes("offline")) return FaExclamationTriangle;

  return FaCheckCircle;
}

export default function StatCard({
  label,
  value,
  accent = "green",
}: {
  label: string;
  value: string | number;
  accent?: "green" | "orange" | "blue";
}) {
  const Icon = getStatIcon(label);

  return (
    <div className="relative h-36 overflow-hidden rounded-lg bg-white">
      {/* Wavy orange band — covers the top half of the card, white below */}
      <svg
        viewBox="0 0 200 40"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-1/2 w-full"
        aria-hidden="true"
      >
        <path
          d="M0,0 L0,20 C25,5 75,35 100,20 C125,5 175,35 200,20 L200,0 Z"
          fill="currentColor"
          className="text-orange-50/50"
        />
      </svg>

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-950">{label}</p>
          <span className="rounded-md bg-blue-50 p-2 text-lg text-blue-950" aria-hidden="true">
            <Icon />
          </span>
        </div>
        <p className="text-xl font-bold text-orange-500/60">{value}</p>
      </div>
    </div>
  );
}