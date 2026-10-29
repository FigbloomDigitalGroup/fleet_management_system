"use client";

import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheck } from "react-icons/fi";
import { apiRequest, errorMessage } from "../lib/api";
import { useFleetTheme } from "../context/FleetThemeContext";
import { FleetTheme, HEX_COLOR, TEXT_SIZES, THEMES, contrastWithWhite, makeCustomTheme } from "../lib/themes";

// Settings → Appearance (company owner): the dashboard theme and text size
// for everyone in the company — one of the ready themes, or Custom with the
// owner's own two colours. Picking previews it straight away across the
// whole portal; Save keeps it, Cancel (or leaving the page) drops it.

// Quick picks for the custom colours — any colour can still be chosen.
const MAIN_SWATCHES = ["#0e4f27", "#6d28d9", "#1d4ed8", "#0f766e", "#334155", "#9f1239", "#7c2d12", "#111827"];
const ACCENT_SWATCHES = ["#ff8a12", "#ec4899", "#f59e0b", "#f43f5e", "#0ea5e9", "#22c55e", "#eab308", "#a855f7"];

function ThemeCard({ t, selected, onSelect }: { t: FleetTheme; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative overflow-hidden rounded-lg text-left ring-1 transition-all ${
        selected ? "ring-2 ring-offset-2" : "ring-gray-200 hover:ring-gray-300"
      }`}
      style={selected ? ({ "--tw-ring-color": t.main[6] } as React.CSSProperties) : undefined}
    >
      {/* Mini dashboard: sidebar, a heading bar, a button and a highlight */}
      <div className="flex h-20">
        <div className="flex w-1/4 flex-col gap-1 p-1.5" style={{ background: t.main[10] }}>
          <span className="h-1.5 rounded-sm bg-white/70" />
          <span className="h-1.5 rounded-sm" style={{ background: t.main[8] }} />
          <span className="h-1.5 rounded-sm bg-white/30" />
          <span className="h-1.5 rounded-sm bg-white/30" />
        </div>
        <div className="flex flex-1 flex-col justify-between bg-gray-50 p-2">
          <span className="h-2 w-2/3 rounded-sm" style={{ background: t.main[6] }} />
          <span className="h-1.5 w-1/2 rounded-sm" style={{ background: t.main[2] }} />
          <div className="flex gap-1.5">
            <span className="h-3 w-8 rounded-sm" style={{ background: t.main[6] }} />
            <span className="h-3 w-8 rounded-sm" style={{ background: t.accent[5] }} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-white px-2.5 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{t.name}</p>
          <p className="truncate text-[11px] text-gray-500">{t.description}</p>
        </div>
        {selected && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: t.main[6] }}>
            <FiCheck size={12} />
          </span>
        )}
      </div>
    </button>
  );
}

// One custom colour: the browser's colour panel, an exact hex code box, and
// quick swatches. The hex box keeps what's being typed and only applies it
// once it's a whole colour.
function ColorField({
  label,
  hint,
  value,
  swatches,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  swatches: string[];
  onChange: (hex: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const typed = text.startsWith("#") ? text : `#${text}`;
  const invalid = text !== "" && !HEX_COLOR.test(typed);

  return (
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="mb-2 text-xs text-gray-500">{hint}</p>
      <div className="flex items-center gap-2">
        <label
          className="relative h-10 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-black/10"
          style={{ background: value }}
          title="Open the colour panel"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} — colour panel`}
          />
        </label>
        <input
          type="text"
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            const hex = v.startsWith("#") ? v : `#${v}`;
            if (HEX_COLOR.test(hex)) onChange(hex.toLowerCase());
          }}
          aria-label={`${label} — hex code`}
          aria-invalid={invalid}
          className={`w-28 rounded border px-2.5 py-2 font-mono text-sm uppercase outline-none ${
            invalid ? "border-red-400 focus:border-red-500" : "border-gray-300 focus:border-teal-600"
          }`}
        />
      </div>
      {invalid && <p className="mt-1 text-xs text-red-600">Use 6 hex digits, like #7C3AED</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c.toUpperCase()}
            aria-label={`Use ${c}`}
            className={`h-6 w-6 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 ${
              value.toLowerCase() === c ? "ring-2 ring-gray-900 ring-offset-1" : ""
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AppearanceSettings() {
  const { theme, textSize, customMain, customAccent, saved, preview, resetPreview, commit } = useFleetTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const isCustom = theme === "custom";
  const changed =
    theme !== saved.theme ||
    textSize !== saved.textSize ||
    (isCustom && (customMain !== saved.customMain || customAccent !== saved.customAccent));
  const customTheme = makeCustomTheme(customMain, customAccent);
  // White text on the main colour (buttons, the sidebar's active item).
  const lowContrast = contrastWithWhite(customMain) < 3;

  // An unsaved preview shouldn't follow the owner to other pages.
  useEffect(() => resetPreview, [resetPreview]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = isCustom
        ? { theme, textSize, customMainColor: customMain, customAccentColor: customAccent }
        : { theme, textSize };
      await apiRequest("/api/companies/me/appearance", { method: "PATCH", body: JSON.stringify(body) });
      commit({ theme, textSize, customMain, customAccent });
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the appearance"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-base font-semibold text-gray-900">Appearance</h2>
      <p className="mt-0.5 text-sm text-gray-500">
        Your dashboard&apos;s colours and text size — for everyone in your company. Click to preview.
      </p>

      <h3 className="mb-2 mt-5 text-sm font-medium text-gray-700">Theme</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <ThemeCard key={t.id} t={t} selected={theme === t.id} onSelect={() => preview({ theme: t.id })} />
        ))}
        <ThemeCard t={customTheme} selected={isCustom} onSelect={() => preview({ theme: "custom" })} />
      </div>

      {isCustom && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-900">Your colours</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField
              label="Main colour"
              hint="Sidebar, buttons, links and charts"
              value={customMain}
              swatches={MAIN_SWATCHES}
              onChange={(hex) => preview({ customMain: hex })}
            />
            <ColorField
              label="Accent colour"
              hint="Highlights and call-to-action buttons (orange today)"
              value={customAccent}
              swatches={ACCENT_SWATCHES}
              onChange={(hex) => preview({ customAccent: hex })}
            />
          </div>

          {/* The shades the app will use, built from the two colours */}
          <div className="mt-4 space-y-1.5" aria-hidden="true">
            {[customTheme.main, customTheme.accent].map((scale, row) => (
              <div key={row} className="flex overflow-hidden rounded-md ring-1 ring-black/5">
                {scale.map((c, i) => (
                  <span key={i} className="h-5 flex-1" style={{ background: c }} />
                ))}
              </div>
            ))}
          </div>

          {lowContrast && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-700">
              <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
              This main colour is quite light — white text on buttons may be hard to read. A darker shade works better.
            </p>
          )}
        </div>
      )}

      <h3 className="mb-2 mt-6 text-sm font-medium text-gray-700">Text size</h3>
      <div className="inline-flex rounded border border-gray-300" role="radiogroup" aria-label="Text size">
        {TEXT_SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={textSize === s.id}
            onClick={() => preview({ textSize: s.id })}
            className={`px-4 py-2 ${textSize === s.id ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            style={{ fontSize: s.rootPx - 2 }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!changed || saving}
          className="rounded bg-orange-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save appearance"}
        </button>
        {changed && !saving && (
          <button type="button" onClick={resetPreview} className="text-sm text-gray-500 hover:text-gray-800">
            Cancel
          </button>
        )}
        {savedNote && <span className="text-sm text-teal-600">Saved — everyone in your company now sees this look.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  );
}
