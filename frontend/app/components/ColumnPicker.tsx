"use client";

import { useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import Switch from "./Switch";

// Which optional columns a report table shows (like Traccar's report column
// selector), remembered per browser under `storageKey`. Starts with the
// `defaults`; storage being unavailable just means the choice isn't kept.
export function useStoredColumns<K extends string>(storageKey: string, allKeys: K[], defaults: K[]) {
  const [visible, setVisible] = useState<K[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(saved)) return allKeys.filter((k) => saved.includes(k));
    } catch {
      // Storage unavailable or corrupt — fall back to the defaults.
    }
    return defaults;
  });

  function toggle(key: K) {
    const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key];
    setVisible(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Not remembered — the choice still applies for this visit.
    }
  }

  return { visible, toggle };
}

// "Columns · 6 of 9 shown" dropdown with a switch per column.
export default function ColumnPicker<K extends string>({
  columns,
  visible,
  onToggle,
}: {
  columns: { key: K; label: string }[];
  visible: K[];
  onToggle: (key: K) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = columns.filter((c) => visible.includes(c.key)).length;

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-600">Columns</label>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        {shown} of {columns.length} shown
        <FiChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg bg-white p-2 shadow-xl ring-1 ring-black/5">
            {columns.map((c) => (
              <label
                key={c.key}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="flex-1">{c.label}</span>
                <Switch size="sm" checked={visible.includes(c.key)} onChange={() => onToggle(c.key)} />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
