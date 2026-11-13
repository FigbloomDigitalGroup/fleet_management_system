"use client";

import { ReactNode, useState } from "react";
import { FiChevronDown, FiFilter } from "react-icons/fi";

// A filter bar that is always open on tablets and computers, and folds into
// one "Filters" button on phones (with how many filters are on), so the list
// itself isn't pushed a whole screen down.
export default function FiltersPanel({
  children,
  activeCount = 0,
  className = "",
}: {
  children: ReactNode;
  activeCount?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg bg-white shadow-sm ring-1 ring-black/5 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 sm:hidden"
      >
        <FiFilter size={15} className="shrink-0 text-teal-700" />
        <span className="flex-1 text-left">Filters</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white">{activeCount}</span>
        )}
        <FiChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`${open ? "block border-t border-gray-100" : "hidden"} p-4 sm:block sm:border-0`}>{children}</div>
    </div>
  );
}
