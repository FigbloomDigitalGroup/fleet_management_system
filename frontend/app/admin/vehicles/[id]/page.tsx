"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import FullPageLoading from "@/app/components/FullPageLoading";
import ZoneStatusBadge from "@/app/components/ZoneStatusBadge";
import VehicleTripsMap from "@/app/components/VehicleTripsMap";
import { usePageHeader } from "@/app/components/DashboardShell";
import { CompanyRecord, GeofenceRecord, VehicleRecord } from "../../../types/auth";

interface LiveLocation {
  vehicleId: string;
  lastLocation: { latitude: number; longitude: number; recordedAt: string } | null;
}

const statusStyles: Record<string, string> = {
  active: "bg-teal-50 text-teal-600 border-teal-200",
  idle: "bg-orange-50 text-orange-600 border-orange-200",
  offline: "bg-gray-100 text-gray-500 border-gray-200",
  maintenance: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_OPTIONS = [
  { value: "active", label: "Set Active", color: "bg-teal-500 hover:bg-teal-600" },
  { value: "idle", label: "Set Idle", color: "bg-orange-500 hover:bg-orange-600" },
  { value: "offline", label: "Set Offline", color: "bg-gray-500 hover:bg-gray-600" },
  { value: "maintenance", label: "Set Maintenance", color: "bg-red-500 hover:bg-red-600" },
];

export default function AdminVehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [lastLocation, setLastLocation] = useState<LiveLocation["lastLocation"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [savingZone, setSavingZone] = useState(false);
  const [mileageInput, setMileageInput] = useState("");
  const [savingMileage, setSavingMileage] = useState(false);
  const [mileageError, setMileageError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiRequest<VehicleRecord>(`/api/vehicles/${id}`);
      setVehicle(data);
      setMileageInput(data.avgConsumptionLPer100Km != null ? String(data.avgConsumptionLPer100Km) : "");
    } catch (err: any) {
      setError(err.message || "Failed to load vehicle");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function updateMileage(e: FormEvent) {
    e.preventDefault();
    setMileageError(null);
    setSavingMileage(true);
    try {
      await apiRequest(`/api/vehicles/${id}`, {
        method: "PUT",
        body: JSON.stringify({ avgConsumptionLPer100Km: parseFloat(mileageInput) }),
      });
      await load();
    } catch (err: any) {
      setMileageError(err.message || "Failed to update mileage");
    } finally {
      setSavingMileage(false);
    }
  }

  useEffect(() => {
    apiRequest<GeofenceRecord[]>("/api/geofences").then(setGeofences).catch(() => {});
    apiRequest<CompanyRecord>("/api/companies/me").then(setCompany).catch(() => {});
    apiRequest<LiveLocation[]>("/api/tracking/live")
      .then((data) => setLastLocation(data.find((v) => v.vehicleId === id)?.lastLocation ?? null))
      .catch(() => {});
  }, [id]);

  async function updateStatus(status: string) {
    setUpdating(true);
    try {
      await apiRequest(`/api/vehicles/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  async function updateStartZone(geofenceId: string) {
    setSavingZone(true);
    try {
      await apiRequest(`/api/vehicles/${id}`, {
        method: "PUT",
        body: JSON.stringify({ startGeofenceId: geofenceId || null }),
      });
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to update starting zone");
    } finally {
      setSavingZone(false);
    }
  }

  usePageHeader(
    vehicle?.plateNumber ?? "Vehicle",
    vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "No make/model set" : undefined
  );

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!vehicle) return null;

  return (
    <div>
      <button onClick={() => router.back()} className="mb-4 rounded-md bg-gray-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600">
        Back
      </button>

      <div className="mb-6 flex items-center gap-2">
        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${statusStyles[vehicle.status]}`}>
          {vehicle.status}
        </span>
        <ZoneStatusBadge lastLocation={lastLocation} geofences={geofences} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
          <h3 className="text-sm font-medium text-gray-700">Vehicle details</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-3">Registration info for this vehicle</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Device ID</dt>
              <dd className="text-gray-900 font-medium mt-0.5">{vehicle.deviceId || "Not set"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Assigned driver</dt>
              <dd className="text-gray-900 font-medium mt-0.5">
                {vehicle.driverId ? vehicle.driverId.fullName : "Unassigned"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Added on</dt>
              <dd className="text-gray-900 font-medium mt-0.5">{new Date(vehicle.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 h-fit">
          <h3 className="text-sm font-medium text-gray-700">Change status</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-4">Updates how this vehicle shows up across the fleet</p>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((opt) => {
              const blocked = opt.value === "active" && !vehicle.driverId;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateStatus(opt.value)}
                  disabled={updating || vehicle.status === opt.value || blocked}
                  title={blocked ? "Assign a driver to this vehicle before setting it active" : undefined}
                  className={`w-full py-2 rounded-md text-sm font-medium text-white disabled:opacity-40 ${opt.color}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {!vehicle.driverId && (
            <p className="text-xs text-gray-400 mt-3">Assign a driver to this vehicle before setting it active.</p>
          )}
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
          <h3 className="text-sm font-medium text-gray-700">Mileage</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-3">
            Expected fuel use for this vehicle — used to estimate fuel cost for its routes and trips.
          </p>
          <form onSubmit={updateMileage} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Liters per 100km</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                required
                value={mileageInput}
                onChange={(e) => setMileageInput(e.target.value)}
                placeholder="12"
                className="w-40 px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              />
            </div>
            <button
              type="submit"
              disabled={savingMileage}
              className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {savingMileage ? "Saving…" : "Save mileage"}
            </button>
          </form>
          {mileageError && <p className="text-xs text-red-600 mt-2">{mileageError}</p>}
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
          <h3 className="text-sm font-medium text-gray-700">Recent trips</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-3">Routes this vehicle has traveled recently</p>
          <VehicleTripsMap vehicleId={vehicle._id} basePath="/admin/trips" />
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
          <h3 className="text-sm font-medium text-gray-700">Daily starting point</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-3">Where this vehicle's driver should start their day</p>

          {geofences.length === 0 && (
            <p className="text-sm text-gray-400">
              No geofence zones yet — create one on the Live Map page to set a starting point.
            </p>
          )}

          {geofences.length === 1 && (
            <p className="text-sm text-gray-700">
              Using the only zone available: <span className="font-medium text-gray-900">{geofences[0].name}</span>
            </p>
          )}

          {geofences.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Starting zone</label>
              <select
                value={vehicle.startGeofenceId?._id || ""}
                onChange={(e) => updateStartZone(e.target.value)}
                disabled={savingZone}
                className="w-full max-w-sm px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 disabled:opacity-60"
              >
                <option value="">
                  {(() => {
                    const defaultZone = geofences.find((g) => g._id === company?.dailyStartPoint?.geofenceId);
                    return `Use company default${defaultZone ? ` (${defaultZone.name})` : " (not set yet)"}`;
                  })()}
                </option>
                {geofences.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                Only needed if this vehicle should start somewhere other than the company default.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

