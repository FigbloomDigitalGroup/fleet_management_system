"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiWifiOff, FiX } from "react-icons/fi";
import { NotifyKind, OFFLINE_MESSAGE, onNotify } from "../lib/notify";

// How long each kind stays up; the offline popup stays until the connection
// comes back.
const DISMISS_MS: Record<NotifyKind, number> = { error: 7000, success: 4000, info: 5000 };
const MAX_VISIBLE = 4;
const OFFLINE_ID = "offline";

interface Popup {
  id: string;
  kind: NotifyKind;
  title: string;
  message: string;
  offline?: boolean;
  // Bumped when the same message arrives again, to restart its timer.
  shownAt: number;
}

const DEFAULT_TITLES: Record<NotifyKind, string> = { error: "Something went wrong", success: "Done", info: "Heads up" };

// Every response error, lost connection and unexpected failure on the site
// shows here as its own popup instead of red text in the console. Mounted
// once in the root layout; anything can raise one with notify()/notifyError().
export default function ErrorPopups() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setPopups((list) => list.filter((p) => p.id !== id));
  }, []);

  const show = useCallback((kind: NotifyKind, message: string, title?: string) => {
    setPopups((list) => {
      // The same message again (a 10s poll failing twice, or several calls
      // in one load) restarts the existing popup rather than stacking copies.
      const same = list.find((p) => p.message === message);
      if (same) return list.map((p) => (p === same ? { ...p, shownAt: Date.now() } : p));
      // While offline, the offline popup already says why requests fail.
      if (kind === "error" && message === OFFLINE_MESSAGE && list.some((p) => p.offline)) return list;
      const popup: Popup = {
        id: `popup-${nextId.current++}`,
        kind,
        title: title || DEFAULT_TITLES[kind],
        message,
        shownAt: Date.now(),
      };
      return [...list, popup].slice(-MAX_VISIBLE);
    });
  }, []);

  useEffect(() => onNotify((d) => show(d.kind, d.message, d.title)), [show]);

  // Connection lost / back.
  useEffect(() => {
    function handleOffline() {
      setPopups((list) => [
        ...list.filter((p) => !p.offline && p.message !== OFFLINE_MESSAGE),
        {
          id: OFFLINE_ID,
          kind: "error",
          title: "Oops, you are not connected",
          message: "Check your Wi-Fi or mobile data. We'll carry on as soon as you're back online.",
          offline: true,
          shownAt: Date.now(),
        },
      ]);
    }
    function handleOnline() {
      setPopups((list) => list.filter((p) => !p.offline));
      show("success", "Your connection is back.", "You're back online");
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    // Already offline when the page opened.
    const initial = setTimeout(() => {
      if (navigator.onLine === false) handleOffline();
    }, 0);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [show]);

  // Failures nobody caught. API errors have already shown their popup, so
  // they're only kept out of the console; anything else gets one too.
  useEffect(() => {
    function handleRejection(e: PromiseRejectionEvent) {
      const reason = e.reason as { message?: string; notified?: boolean } | undefined;
      e.preventDefault();
      if (reason?.notified) return;
      show("error", reason?.message || "Something unexpected went wrong. Please try again.");
    }
    function handleError(e: ErrorEvent) {
      // Harmless browser noise, not a real failure.
      if (e.message?.includes("ResizeObserver")) return;
      show("error", "Something on this page stopped working. Refreshing the page usually fixes it.");
    }
    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, [show]);

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-4 top-4 z-[200] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-96"
    >
      <AnimatePresence initial={false}>
        {popups.map((p) => (
          <PopupCard key={p.id} popup={p} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const STYLES: Record<NotifyKind, { bar: string; icon: string }> = {
  error: { bar: "bg-red-500", icon: "text-red-600" },
  success: { bar: "bg-teal-500", icon: "text-teal-600" },
  info: { bar: "bg-orange-500", icon: "text-orange-600" },
};

function PopupCard({ popup, onDismiss }: { popup: Popup; onDismiss: (id: string) => void }) {
  const { id, kind, title, message, offline, shownAt } = popup;
  const Icon = offline ? FiWifiOff : kind === "success" ? FiCheckCircle : kind === "info" ? FiInfo : FiAlertCircle;
  const style = STYLES[kind];

  useEffect(() => {
    if (offline) return;
    const timer = setTimeout(() => onDismiss(id), DISMISS_MS[kind]);
    return () => clearTimeout(timer);
  }, [id, kind, offline, shownAt, onDismiss]);

  return (
    <motion.div
      layout
      role={kind === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
      className="pointer-events-auto relative flex w-full gap-3 overflow-hidden rounded-xl bg-white py-3 pl-5 pr-3 shadow-xl shadow-gray-900/10 ring-1 ring-black/5"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      <Icon size={20} className={`mt-0.5 shrink-0 ${style.icon}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 break-words text-sm text-gray-600">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss"
        className="h-7 w-7 shrink-0 rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <FiX size={16} className="mx-auto" />
      </button>
    </motion.div>
  );
}
