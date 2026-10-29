"use client";

import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { apiRequest, errorMessage } from "../lib/api";
import { useFleetTheme } from "../context/FleetThemeContext";
import { TEXT_SIZES, THEMES } from "../lib/themes";

// Settings → Appearance (company owner): the dashboard theme and text size
// for everyone in the company. Picking one previews it straight away across
// the whole portal; Save keeps it, Cancel (or leaving the page) drops it.
export default function AppearanceSettings() {
  const { theme, textSize, saved, preview, resetPreview, commit } = useFleetTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const changed = theme !== saved.theme || textSize !== saved.textSize;

  // An unsaved preview shouldn't follow the owner to other pages.
  useEffect(() => resetPreview, [resetPreview]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/companies/me/appearance", { method: "PATCH", body: JSON.stringify({ theme, textSize }) });
      commit({ theme, textSize });
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const selected = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => preview({ theme: t.id })}
              className={`group relative overflow-hidden rounded-lg text-left ring-1 transition-all ${
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
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: t.main[6] }}
                  >
                    <FiCheck size={12} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

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
