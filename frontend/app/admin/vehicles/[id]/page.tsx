"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import FullPageLoading from "@/app/components/FullPageLoading";
import { VehicleRecord } from "../../../types/auth";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  async function load() {
    try {
      const data = await apiRequest<VehicleRecord>(`/api/vehicles/${id}`);
      setVehicle(data);
    } catch (err: any) {
      setError(err.message || "Failed to load vehicle");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!vehicle) return null;

  return (
    <div>
      <button onClick={() => router.back()} className="mb-4 rounded-md bg-gray-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600">
        Back
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">{vehicle.plateNumber}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "No make/model set"}
          </p>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${statusStyles[vehicle.status]}`}>
          {vehicle.status}
        </span>
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
      </div>
    </div>
  );
}

