
"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiRequest } from "../lib/api";
import { AlertRecord, VehicleRecord } from "../types/auth";
import Skeleton from "./Skeleton";
import WheelIcon from "./WheelIcon";

export default function AlertsList() {
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/admin") ? "/admin/vehicles" : "/company/vehicles";
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

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

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Alerts list */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
        {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <>
        <p className="text-xs text-teal-600 px-5 pt-4">
          Speeding, geofence, and offline alerts raised across your fleet.
        </p>
        <table className="w-full text-sm mt-2">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Vehicle</th>
              <th className="text-left px-5 py-3 font-medium">Type</th>
              <th className="text-left px-5 py-3 font-medium">Message</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  No alerts yet.
                </td>
              </tr>
            ) : (
              alerts.map((a) => (
                <tr key={a._id} className="border-t border-gray-100">
                  <td className="px-5 py-3 text-xs font-bold text-gray-900">
                    {a.vehicleId ? (
                      <Link href={`${basePath}/${a.vehicleId._id}`} className="inline-flex items-center gap-2 hover:text-teal-600">
                        <WheelIcon size={16} className="spin-slow shrink-0" />
                        {a.vehicleId.plateNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{a.type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3 text-xs text-teal-600">{a.message}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${a.resolved
                          ? "bg-gray-100 text-gray-500 border-gray-200"
                          : "bg-orange-50 text-orange-600 border-orange-200"
                        }`}
                    >
                      {a.resolved ? "resolved" : "open"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {!a.resolved && (
                      <button
                        onClick={() => handleResolve(a._id)}
                        disabled={resolvingId === a._id}
                        className="text-xs text-teal-600 hover:underline disabled:opacity-50"
                      >
                        Mark resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
          </>
        )}
      </div>

      {/* Message driver form */}
      {!loading && !error && (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 h-fit">
        <h3 className="text-sm font-medium text-gray-700">Message driver</h3>
        <p className="text-xs text-teal-600 mt-0.5 mb-4">
          Sends straight to this vehicle's driver in the mobile app — it won't appear in the list on the left.
        </p>
        <form onSubmit={handleSendAlert} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Please return to the depot by 5pm…"
              rows={3}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            />
          </div>

          {formError && <p className="text-xs text-red-600">{formError}</p>}
          {sendSuccess && (
            <p className="text-xs text-teal-600">Sent — it'll show up on the driver's phone, not here.</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || vehicles.length === 0}
            className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
          >
            {isSubmitting ? "Sending…" : "Send message"}
          </button>
        </form>
      </div>
      )}
    </div>
  );
}