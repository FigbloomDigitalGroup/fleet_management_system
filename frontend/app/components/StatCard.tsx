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
    <div className="rounded-lg bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-blue-950">{label}</p>
        <span className="rounded-md bg-blue-50 p-2 text-lg text-blue-950" aria-hidden="true">
          <Icon />
        </span>
      </div>
      <p className="text-2xl font-bold text-blue-950">{value}</p>
    </div>
  );
}