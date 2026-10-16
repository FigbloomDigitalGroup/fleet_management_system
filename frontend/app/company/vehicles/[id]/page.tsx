"use client";

import { useEffect, useState } from "react";
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

export default function CompanyVehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [lastLocation, setLastLocation] = useState<LiveLocation["lastLocation"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<VehicleRecord>(`/api/vehicles/${id}`)
      .then(setVehicle)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    apiRequest<CompanyRecord>("/api/companies/me").then(setCompany).catch(() => {});
    apiRequest<GeofenceRecord[]>("/api/geofences").then(setGeofences).catch(() => {});
    apiRequest<LiveLocation[]>("/api/tracking/live")
      .then((data) => setLastLocation(data.find((v) => v.vehicleId === id)?.lastLocation ?? null))
      .catch(() => {});
  }, [id]);

  const defaultZoneName = geofences.find((g) => g._id === company?.dailyStartPoint?.geofenceId)?.name ?? null;
  const startZoneName = vehicle?.startGeofenceId?.name ?? defaultZoneName;

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
          <div>
            <dt className="text-gray-500">Daily starting point</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {startZoneName || "Not set yet"}
              {!vehicle.startGeofenceId && startZoneName && (
                <span className="text-gray-400 font-normal"> (company default)</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Mileage</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {vehicle.avgConsumptionLPer100Km != null ? `${vehicle.avgConsumptionLPer100Km} L/100km` : "Not set"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-teal-600 mt-4">Status changes and starting points are managed by your fleet Admin.</p>
      </div>

      <div className="mt-4 max-w-xl bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <h3 className="text-sm font-medium text-gray-700">Recent trips</h3>
        <p className="text-xs text-teal-600 mt-0.5 mb-3">Routes this vehicle has traveled recently</p>
        <VehicleTripsMap vehicleId={vehicle._id} basePath="/company/trips" />
      </div>
    </div>
  );
}