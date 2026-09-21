"use client";

import { FaFlagCheckered } from "react-icons/fa";
import { FiX } from "react-icons/fi";

interface LatLng {
  lat: number;
  lng: number;
}

export default function StartPointPanel({
  open,
  pickedPoint,
  savedPoint,
  zoneName,
  onClose,
  onReopen,
  onSave,
  saving,
  error,
}: {
  open: boolean;
  pickedPoint: LatLng | null;
  savedPoint: LatLng | null;
  zoneName: string | null;
  onClose: () => void;
  onReopen: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  if (!open) {
    return (
      <button
        onClick={onReopen}
        className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-blue-950 px-4 py-2 text-xs font-medium text-white shadow-lg transition-colors hover:bg-blue-900"
      >
        <FaFlagCheckered size={12} />
        Set driver starting point
      </button>
    );
  }

  const hasPick = pickedPoint !== null;
  const canSave = hasPick && !!zoneName;

  return (
    <div className="animate-panel-up absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-white p-5 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-blue-950">Where should drivers start each day?</h3>
          <p className="mt-0.5 text-xs text-teal-600">
            Click a spot on the map inside one of your geofence zones — that becomes the daily starting point.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="shrink-0 text-gray-400 hover:text-gray-600">
          <FiX size={18} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs">
          {hasPick ? (
            zoneName ? (
              <span className="font-medium text-teal-600">Inside &ldquo;{zoneName}&rdquo; — ready to save.</span>
            ) : (
              <span className="font-medium text-red-500">
                Outside any geofence zone — pick a spot inside a shaded zone.
              </span>
            )
          ) : savedPoint ? (
            <span className="text-gray-500">A starting point is already set. Click the map to change it.</span>
          ) : (
            <span className="text-gray-400">No starting point set yet. Click the map to place one.</span>
          )}
        </div>

        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="rounded-md bg-orange-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save starting point"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
