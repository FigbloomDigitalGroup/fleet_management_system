"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { apiRequest } from "../../../lib/api";
import { VehicleRecord } from "../../../types/auth";

const statusStyles: Record<string, string> = {
  active: "bg-green-50 text-green-600 border-green-200",
  idle: "bg-orange-50 text-orange-600 border-orange-200",
  offline: "bg-gray-100 text-gray-500 border-gray-200",
  maintenance: "bg-red-50 text-red-600 border-red-200",
};

export default function CompanyVehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<VehicleRecord>(`/api/vehicles/${id}`)
      .then(setVehicle)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!vehicle) return null;

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <FiArrowLeft size={14} /> Back
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vehicle.plateNumber}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "No make/model set"}
          </p>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${statusStyles[vehicle.status]}`}>
          {vehicle.status}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-xl">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Vehicle details</h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
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
        <p className="text-xs text-gray-400 mt-4">Status changes are managed by your fleet Admin.</p>
      </div>
    </div>
  );
}