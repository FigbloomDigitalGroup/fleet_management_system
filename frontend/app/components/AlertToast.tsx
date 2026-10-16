"use client";

import { createElement, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiX } from "react-icons/fi";
import { alertTypeIcon, alertTypeLabel, isCriticalAlert } from "../lib/alertTypes";
import { AlertRecord } from "../types/auth";

const AUTO_DISMISS_MS = 6000;

export interface ToastAlert {
  id: string;
  alert: AlertRecord;
}

export default function AlertToastStack({
  toasts,
  onDismiss,
  liveMapHref,
}: {
  toasts: ToastAlert[];
  onDismiss: (id: string) => void;
  liveMapHref?: string | null;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <AlertToast key={t.id} toast={t} onDismiss={onDismiss} liveMapHref={liveMapHref} />
      ))}
    </div>
  );
}

function AlertToast({
  toast,
  onDismiss,
  liveMapHref,
}: {
  toast: ToastAlert;
  onDismiss: (id: string) => void;
  liveMapHref?: string | null;
}) {
  const { id, alert } = toast;
  const critical = isCriticalAlert(alert.type);
  const router = useRouter();
  const vehicleId = alert.vehicleId?._id;
  const canJump = !!(vehicleId && liveMapHref);

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  // Jumps the Live Map to this alert's vehicle — handed off the same way an
  // AI-drafted route/geofence is (sessionStorage for a fresh page load, a
  // CustomEvent for when we're already sitting on the Live Map and a
  // navigation to the same URL would otherwise be a no-op).
  function handleJump() {
    if (!canJump) return;
    sessionStorage.setItem("fleet:jump-to-vehicle", vehicleId!);
    window.dispatchEvent(new CustomEvent("fleet:jump-to-vehicle", { detail: { vehicleId } }));
    router.push(liveMapHref!);
    onDismiss(id);
  }

  return (
    <div
      onClick={canJump ? handleJump : undefined}
      className={`animate-toast-in pointer-events-auto flex w-[340px] max-w-[90vw] items-start gap-3 rounded-md border-l-4 ${critical ? "border-red-500" : "border-orange-500"} bg-white px-4 py-3 shadow-lg ring-1 ring-black/5 ${canJump ? "cursor-pointer hover:bg-gray-50" : ""}`}
    >
      <span className={`mt-0.5 ${critical ? "text-red-500" : "text-orange-500"}`}>
        {createElement(alertTypeIcon(alert.type), { size: 18 })}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-gray-900">
          {alert.vehicleId?.plateNumber || "Fleet alert"}
          <span className="ml-1.5 font-normal text-gray-400">· {alertTypeLabel(alert.type)}</span>
        </p>
        <p className="mt-0.5 text-xs text-teal-600">{alert.message}</p>
        {canJump && <p className="mt-1 text-[11px] font-medium text-gray-400">Click to view on the map</p>}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(id);
        }}
        aria-label="Dismiss"
        className="text-gray-400 hover:text-gray-600"
      >
        <FiX size={14} />
      </button>
    </div>
  );
}
