import {
  FaBell,
  FaBuilding,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaTools,
  FaUserShield,
  FaUsers,
} from "react-icons/fa";
import { IoCarSportSharp } from "react-icons/io5";

function getStatIcon(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("vehicle")) return IoCarSportSharp;
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

const accentChip = {
  green: "bg-teal-50 text-teal-600",
  orange: "bg-orange-50 text-orange-600",
  blue: "bg-blue-50 text-blue-700",
};

export default function StatCard({
  label,
  value,
  description,
  accent = "green",
  background = "bg-white",
  light = false,
}: {
  label: string;
  value: string | number;
  description?: string;
  accent?: "green" | "orange" | "blue";
  background?: string;
  light?: boolean;
}) {
  const Icon = getStatIcon(label);

  return (
    <div className={`relative overflow-hidden rounded-2xl ${background} shadow-sm ring-1 ring-black/5`}>
      <div className="relative flex items-start justify-between gap-3 p-4">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${light ? "text-white" : "text-blue-950"}`}>
            {label}
          </p>
          <p className={`mt-1.5 text-xl font-bold ${light ? "text-white" : "text-blue-950"}`}>{value}</p>
          {description && (
            <p className={`text-xs mt-1 ${light ? "text-white/80" : "text-teal-600"}`}>{description}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-xl p-2 text-base ${light ? "bg-white/20 text-white" : accentChip[accent]}`}
          aria-hidden="true"
        >
          <Icon />
        </span>
      </div>
    </div>
  );
}