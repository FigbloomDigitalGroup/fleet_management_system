"use client";

import { useEffect } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import { AlertRecord } from "../types/auth";

const AUTO_DISMISS_MS = 6000;

export interface ToastAlert {
  id: string;
  alert: AlertRecord;
}

export default function AlertToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastAlert[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <AlertToast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function AlertToast({ toast, onDismiss }: { toast: ToastAlert; onDismiss: (id: string) => void }) {
  const { id, alert } = toast;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div className="animate-toast-in pointer-events-auto flex w-[340px] max-w-[90vw] items-start gap-3 rounded-xl border-l-4 border-orange-500 bg-white px-4 py-3 shadow-lg ring-1 ring-black/5">
      <span className="mt-0.5 text-orange-500">
        <FiAlertTriangle size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-gray-900">
          {alert.vehicleId?.plateNumber || "Fleet alert"}
          <span className="ml-1.5 font-normal text-gray-400">· {alert.type.replace(/_/g, " ")}</span>
        </p>
        <p className="mt-0.5 text-xs text-teal-600">{alert.message}</p>
      </div>
      <button onClick={() => onDismiss(id)} aria-label="Dismiss" className="text-gray-400 hover:text-gray-600">
        <FiX size={14} />
      </button>
    </div>
  );
}
