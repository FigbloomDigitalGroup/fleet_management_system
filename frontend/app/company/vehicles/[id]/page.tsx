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

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 max-w-xl">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Vehicle details</h3>
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
        <p className="text-xs text-teal-600 mt-4">Status changes are managed by your fleet Admin.</p>
      </div>
    </div>
  );
}