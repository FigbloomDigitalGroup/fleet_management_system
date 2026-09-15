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
    <div className={`relative min-h-36 overflow-hidden rounded-2xl ${background} shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md`}>
      {/* Faint wavy band on top — barely visible */}
      <svg
        viewBox="0 0 200 40"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-1/2 w-full"
        aria-hidden="true"
      >
        <path
          d="M0,0 L0,20 C25,5 75,35 100,20 C125,5 175,35 200,20 L200,0 Z"
          fill="currentColor"
          className={light ? "text-white/10" : "text-orange-500/5"}
        />
      </svg>

      <div className="relative flex h-full flex-col justify-between gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-xs font-medium uppercase tracking-wide ${light ? "text-white" : "text-blue-950"}`}>
            {label}
          </p>
          <span
            className={`rounded-xl p-2.5 text-lg ${light ? "bg-white/20 text-white" : accentChip[accent]}`}
            aria-hidden="true"
          >
            <Icon />
          </span>
        </div>
        <div>
          <p className={`text-2xl font-bold ${light ? "text-white" : "text-blue-950"}`}>{value}</p>
          {description && (
            <p className={`text-xs mt-1 ${light ? "text-white/80" : "text-teal-600"}`}>{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}