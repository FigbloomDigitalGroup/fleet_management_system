"use client";

import { useState } from "react";
import { DEFAULT_CUSTOM, FleetTheme, TEXT_SIZES, THEMES, TextSize, makeCustomTheme } from "../lib/themes";

// Landing page: the dashboard themes an owner can pick (Settings →
// Appearance), tried on a small dashboard mock. The mock is coloured inline
// from the theme's scales, so choosing here doesn't recolour the page.
const CHOICES: FleetTheme[] = [...THEMES, makeCustomTheme(DEFAULT_CUSTOM.main, DEFAULT_CUSTOM.accent)];
const BARS = [40, 65, 52, 80, 58, 90, 72];
const MOCK_SCALE: Record<TextSize, number> = { small: 0.9, normal: 1, large: 1.12 };
// Landing page wording where it differs from the Settings page's.
const LANDING_DESCRIPTIONS: Partial<Record<string, string>> = { forest: "Green & orange, the Figbloom colours" };

export default function ThemeShowcase() {
  const [theme, setTheme] = useState<FleetTheme>(CHOICES[0]);
  const [textSize, setTextSize] = useState<TextSize>("normal");
  const main = theme.main;
  const accent = theme.accent;

  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CHOICES.map((t) => {
            const active = t.id === theme.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={active}
                className={`rounded-xl border p-3 text-left transition ${
                  active ? "border-gray-950 shadow-md" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <span className="flex gap-1">
                  <span className="h-5 w-5 rounded-full" style={{ background: t.main[6] }} />
                  <span className="h-5 w-5 rounded-full" style={{ background: t.accent[5] }} />
                </span>
                <span className="mt-2 block text-sm font-semibold text-gray-950">{t.name}</span>
                <span className="block text-[11px] text-gray-500">{LANDING_DESCRIPTIONS[t.id] ?? t.description}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-xs font-medium uppercase tracking-wide text-gray-400">Text size</p>
        <div className="mt-2 inline-flex rounded-full border border-gray-200 p-1">
          {TEXT_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setTextSize(s.id)}
              aria-pressed={s.id === textSize}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                s.id === textSize ? "bg-gray-950 text-white" : "text-gray-600 hover:text-gray-950"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* The dashboard, in the chosen look */}
      <div
        aria-label={`Dashboard preview in ${theme.name}`}
        className="flex h-72 overflow-hidden rounded-2xl shadow-2xl shadow-gray-300/60 ring-1 ring-black/5 md:h-80"
        style={{ fontSize: `${MOCK_SCALE[textSize]}rem` }}
      >
        <div className="flex w-1/4 flex-col gap-2 p-3 transition-colors duration-500" style={{ background: main[10] }}>
          <span className="mb-2 h-3 w-3/4 rounded-full bg-white/80" />
          {["Dashboard", "Live map", "Trips", "Alerts"].map((item, i) => (
            <span
              key={item}
              className="truncate rounded-md px-2 py-1 text-[0.65em] text-white transition-colors duration-500"
              style={{ background: i === 0 ? main[6] : "transparent", opacity: i === 0 ? 1 : 0.7 }}
            >
              {item}
            </span>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-3 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[0.85em] font-semibold text-gray-900">Fleet overview</span>
            <span
              className="rounded-md px-2.5 py-1 text-[0.65em] font-medium text-white transition-colors duration-500"
              style={{ background: accent[5] }}
            >
              Add vehicle
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Active", "24"],
              ["On trip", "11"],
              ["Alerts", "3"],
            ].map(([label, value], i) => (
              <div key={label} className="rounded-lg bg-white p-2 ring-1 ring-black/5">
                <span className="block text-[0.6em] text-gray-500">{label}</span>
                <span
                  className="block text-[1.1em] font-bold transition-colors duration-500"
                  style={{ color: i === 2 ? accent[6] : main[6] }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-1 items-end gap-1.5 rounded-lg bg-white p-3 ring-1 ring-black/5">
            {BARS.map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-t transition-colors duration-500"
                style={{ height: `${h}%`, background: i === BARS.length - 1 ? accent[5] : main[i % 2 ? 5 : 6] }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
