
"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../lib/api";
import { AlertRecord, VehicleRecord } from "../types/auth";
import FullPageLoading from "./FullPageLoading";

const ALERT_TYPES = [
  { value: "speeding", label: "Speeding" },
  { value: "geofence_entry", label: "Geofence entry" },
  { value: "geofence_exit", label: "Geofence exit" },
  { value: "unauthorized_movement", label: "Unauthorized movement" },
  { value: "device_offline", label: "Device offline" },
  { value: "maintenance_due", label: "Maintenance due" },
];

export default function AlertsList() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [vehicleId, setVehicleId] = useState("");
  const [type, setType] = useState(ALERT_TYPES[0].value);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    try {
      const [alertData, vehicleData] = await Promise.all([
        apiRequest<AlertRecord[]>("/api/alerts"),
        apiRequest<VehicleRecord[]>("/api/vehicles"),
      ]);
      setAlerts(alertData);
      setVehicles(vehicleData);
      if (vehicleData.length > 0 && !vehicleId) setVehicleId(vehicleData[0]._id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
      setFormError("Add a vehicle first before sending an alert.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/api/alerts", {
        method: "POST",
        body: JSON.stringify({ vehicleId, type, message }),
      });
      setMessage("");
      await load();
    } catch (err: any) {
      setFormError(err.message || "Failed to send alert");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) return <FullPageLoading label="Loading alerts" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Alerts list */}
      <div className="lg:col-span-2 bg-white rounded-lg overflow-hidden">
        <p className="text-xs text-gray-400 px-5 pt-4">
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
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {a.vehicleId?.plateNumber || "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{a.type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3 text-gray-600">{a.message}</td>
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
                        className="text-xs text-green-600 hover:underline disabled:opacity-50"
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
      </div>

      {/* Send alert form */}
      <div className="bg-white rounded-lg p-5 h-fit">
        <h3 className="text-sm font-medium text-gray-700">Send an alert</h3>
        <p className="text-xs text-gray-400 mt-0.5 mb-4">Manually notify the team about a vehicle issue.</p>
        <form onSubmit={handleSendAlert} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Alert type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
            >
              {ALERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
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
              placeholder="Describe what's happening…"
              rows={3}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
            />
          </div>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={isSubmitting || vehicles.length === 0}
            className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
          >
            {isSubmitting ? "Sending…" : "Send alert"}
          </button>
        </form>
      </div>
    </div>
  );
}