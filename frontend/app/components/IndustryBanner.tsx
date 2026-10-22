"use client";

import { FaIndustry } from "react-icons/fa";
import { industryLabel } from "../lib/industries";

// Shows the company's own industry on the dashboard as a plain color card.
export default function IndustryBanner({ industry }: { industry?: string | null }) {
  if (!industry) return null;

  return (
    <div className="relative h-64 overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 bg-orange-500">
      <FaIndustry
        className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-white/25"
        size={88}
        aria-hidden="true"
      />
      <div className="absolute bottom-4 left-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-teal-950">Your industry</p>
        <p className="text-2xl font-bold text-white">{industryLabel(industry)}</p>
      </div>
    </div>
  );
}
