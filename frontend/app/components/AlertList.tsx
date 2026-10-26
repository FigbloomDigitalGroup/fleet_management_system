"use client";

import { createElement, useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiCheck, FiMapPin, FiSearch, FiBellOff } from "react-icons/fi";
import { apiRequest } from "../lib/api";
import { AlertRecord, VehicleRecord } from "../types/auth";
import Skeleton from "./Skeleton";
import Switch from "./Switch";
import { alertTypeIcon, alertTypeLabel, isCriticalAlert } from "../lib/alertTypes";
import { useAdminAccess } from "../lib/adminAccess";
import { useAppShell } from "./AppShell";

type StatusTab = "open" | "resolved" | "all";

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

// "Today" / "Yesterday" / "Mon 20 Oct" — the day heading an alert sits under.
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function AlertsList() {
  const pathname = usePathname();
  const router = useRouter();
  const shell = useAppShell();
  const isAdminPortal = pathname?.startsWith("/admin");
  const basePath = isAdminPortal ? "/admin/vehicles" : "/company/vehicles";
  const liveMapHref = shell?.nav.mapHref ?? (isAdminPortal ? "/admin/live-map" : "/company/live-map");
  const { canDispatch } = useAdminAccess();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Filters
  const [tab, setTab] = useState<StatusTab>("open");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [filterVehicleId, setFilterVehicleId] = useState("");
  const [search, setSearch] = useState("");

  // Message-driver form
  const [vehicleId, setVehicleId] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // load() is also called on a poll interval below — these refs let it read
  // the current vehicleId and first-load status without being redeclared
  // (and the interval re-armed) on every render.
  const vehicleIdRef = useRef(vehicleId);
  vehicleIdRef.current = vehicleId;
  const hasLoadedOnce = useRef(false);

  async function load() {
    try {
      const [alertData, vehicleData] = await Promise.all([
        apiRequest<AlertRecord[]>("/api/alerts"),
        apiRequest<VehicleRecord[]>("/api/vehicles"),
      ]);
      setAlerts(alertData);
      setVehicles(vehicleData);
      if (vehicleData.length > 0 && !vehicleIdRef.current) setVehicleId(vehicleData[0]._id);
      setError(null);
    } catch (err: any) {
      // A background poll hiccup shouldn't blank out an already-visible
      // page — only surface the error if we never loaded successfully.
      if (!hasLoadedOnce.current) setError(err.message);
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      await apiRequest(`/api/alerts/${id}/resolve`, { method: "PATCH" });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResolvingId(null);
    }
  }

  // Same hand-off the alert toasts use to centre the Live Map on a vehicle.
  function viewOnMap(vehicleIdToShow: string) {
    sessionStorage.setItem("fleet:jump-to-vehicle", vehicleIdToShow);
    router.push(liveMapHref);
  }

  async function handleSendAlert(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!vehicleId) {
      setFormError("Add a vehicle first before messaging its driver.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/api/alerts", {
        method: "POST",
        body: JSON.stringify({ vehicleId, type: "admin_message", message }),
      });
      setMessage("");
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 4000);
    } catch (err: any) {
      setFormError(err.message || "Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  }

  const openAlerts = alerts.filter((a) => !a.resolved);
  const counts = {
    open: openAlerts.length,
    critical: openAlerts.filter((a) => isCriticalAlert(a.type)).length,
    resolved: alerts.length - openAlerts.length,
  };

  const query = search.trim().toLowerCase();
  const shown = alerts.filter(
    (a) =>
      (tab === "all" || (tab === "open" ? !a.resolved : a.resolved)) &&
      (!criticalOnly || isCriticalAlert(a.type)) &&
      (!filterVehicleId || a.vehicleId?._id === filterVehicleId) &&
      (!query ||
        a.message.toLowerCase().includes(query) ||
        alertTypeLabel(a.type).toLowerCase().includes(query) ||
        (a.vehicleId?.plateNumber || "").toLowerCase().includes(query))
  );

  // Group under day headings, newest first (the API already sorts that way).
  const groups: { day: string; items: AlertRecord[] }[] = [];
  for (const a of shown) {
    const day = dayLabel(a.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, items: [a] });
  }

  const tabs: { value: StatusTab; label: string; count: number }[] = [
    { value: "open", label: "Open", count: counts.open },
    { value: "resolved", label: "Resolved", count: counts.resolved },
    { value: "all", label: "All", count: alerts.length },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-gray-500">Open</p>
            <p className="font-figures text-2xl font-semibold text-orange-600">{counts.open}</p>
          </div>
          <div className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-gray-500">Critical</p>
            <p className={`font-figures text-2xl font-semibold ${counts.critical ? "text-red-600" : "text-gray-900"}`}>
              {counts.critical}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-gray-500">Resolved recently</p>
            <p className="font-figures text-2xl font-semibold text-gray-900">{counts.resolved}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
            <div className="flex rounded-lg bg-gray-100 p-0.5">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === t.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {t.label} <span className="font-figures text-gray-400">{t.count}</span>
                </button>
              ))}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600">
              <Switch size="sm" checked={criticalOnly} onChange={setCriticalOnly} />
              Critical only
            </label>
            <select
              value={filterVehicleId}
              onChange={(e) => setFilterVehicleId(e.target.value)}
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-600"
            >
              <option value="">All vehicles</option>
              {vehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.plateNumber}
                </option>
              ))}
            </select>
            <div className="flex min-w-40 flex-1 items-center gap-2 rounded border border-gray-300 px-2 py-1.5 focus-within:border-teal-600">
              <FiSearch size={13} className="shrink-0 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search alerts"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </div>
          </div>

          {loading && <Skeleton rows={5} rowClassName="h-14" className="p-5" />}
          {error && <p className="p-5 text-sm text-red-600">{error}</p>}

          {!loading && !error && shown.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                <FiBellOff size={20} />
              </span>
              <p className="text-sm font-medium text-gray-900">
                {tab === "open" && !criticalOnly && !filterVehicleId && !query ? "All clear" : "No alerts match"}
              </p>
              <p className="text-xs text-gray-500">
                {tab === "open" && !criticalOnly && !filterVehicleId && !query
                  ? "Nothing needs attention right now."
                  : "Try another tab or clear the filters."}
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            groups.map((g) => (
              <div key={g.day}>
                <p className="bg-gray-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g.day}</p>
                <ul className="divide-y divide-gray-100">
                  {g.items.map((a) => {
                    const critical = isCriticalAlert(a.type);
                    return (
                      <li key={a._id} className={`flex gap-3 px-4 py-3 ${a.resolved ? "opacity-60" : ""}`}>
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            a.resolved ? "bg-gray-100 text-gray-400" : critical ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                          }`}
                        >
                          {createElement(alertTypeIcon(a.type), { size: 16 })}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-gray-900">{alertTypeLabel(a.type)}</span>
                            {critical && !a.resolved && (
                              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Critical
                              </span>
                            )}
                            {a.vehicleId && (
                              <Link
                                href={`${basePath}/${a.vehicleId._id}`}
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-700"
                              >
                                {a.vehicleId.plateNumber}
                              </Link>
                            )}
                            {a.resolved && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
                                <FiCheck size={11} /> Resolved
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{a.message}</p>
                          <p className="mt-1 text-[11px] text-gray-400" title={new Date(a.createdAt).toLocaleString()}>
                            {timeAgo(a.createdAt)} ·{" "}
                            {new Date(a.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-start">
                          {a.vehicleId && (
                            <button
                              onClick={() => viewOnMap(a.vehicleId!._id)}
                              className="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-teal-300 hover:text-teal-700"
                            >
                              <FiMapPin size={12} /> Map
                            </button>
                          )}
                          {!a.resolved && canDispatch && (
                            <button
                              onClick={() => handleResolve(a._id)}
                              disabled={resolvingId === a._id}
                              className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                            >
                              <FiCheck size={12} /> {resolvingId === a._id ? "Resolving…" : "Resolve"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

          {!loading && !error && (
            <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
              Resolved alerts are cleared automatically 30 minutes after they&apos;re resolved.
            </p>
          )}
        </div>
      </div>

      {/* Message driver form */}
      {!loading && !error && canDispatch && (
        <div className="h-fit rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h3 className="text-sm font-medium text-gray-700">Message driver</h3>
          <p className="mb-4 mt-0.5 text-xs text-teal-600">
            Sends straight to this vehicle&apos;s driver in the mobile app — it won&apos;t appear in the alerts list.
          </p>
          <form onSubmit={handleSendAlert} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              >
                {vehicles.length === 0 && <option value="">No vehicles yet</option>}
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.plateNumber}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Message</label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Please return to the depot by 5pm…"
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              />
            </div>

            {formError && <p className="text-xs text-red-600">{formError}</p>}
            {sendSuccess && <p className="text-xs text-teal-600">Sent — it&apos;ll show up on the driver&apos;s phone, not here.</p>}

            <button
              type="submit"
              disabled={isSubmitting || vehicles.length === 0}
              className="w-full rounded bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
