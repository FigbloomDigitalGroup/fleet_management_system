"use client";

import { useState } from "react";
import { FiEye } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";

// "Open this fleet": Figbloom staff see a customer's owner area (dashboard,
// vehicles, live map, trips, drivers, reports…) read-only. The API records
// who opened which fleet and when (backend/lib/supportSession.js).
export default function OpenFleetButton({
  companyId,
  label = "Open this fleet",
  size = "md",
}: {
  companyId: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const { startSupportView } = useAuth();
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    try {
      await startSupportView(companyId);
    } catch {
      // apiRequest already showed why
      setOpening(false);
    }
  }

  const sizing = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <button
      onClick={open}
      disabled={opening}
      title="See this fleet the way its owner does, read-only. Your visit is recorded."
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-blue-950 font-medium text-white transition-colors hover:bg-blue-900 disabled:opacity-60 ${sizing}`}
    >
      <FiEye size={size === "sm" ? 12 : 14} />
      {opening ? "Opening…" : label}
    </button>
  );
}
