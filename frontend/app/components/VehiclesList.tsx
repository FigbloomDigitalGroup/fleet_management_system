"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { VehicleRecord, DriverRecord, GeofenceRecord } from "../types/auth";
import Skeleton from "./Skeleton";
import ZoneStatusBadge from "./ZoneStatusBadge";

const statusStyles: Record<string, string> = {
  active: "bg-teal-50 text-teal-600 border-teal-200",
  idle: "bg-orange-50 text-orange-600 border-orange-200",
  offline: "bg-gray-100 text-gray-500 border-gray-200",
  maintenance: "bg-red-50 text-red-600 border-red-200",
};

interface LiveLocation {
  vehicleId: string;
  lastLocation: { latitude: number; longitude: number; recordedAt: string } | null;
}

export default function VehiclesList({
  basePath = "/admin/vehicles",
  canAssignDriver = true,
}: {
  basePath?: string;
  canAssignDriver?: boolean;
}) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation["lastLocation"]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [vehicleData, driverData, geofenceData, liveData] = await Promise.all([
        apiRequest<VehicleRecord[]>("/api/vehicles"),
        apiRequest<DriverRecord[]>("/api/users/drivers"),
        apiRequest<GeofenceRecord[]>("/api/geofences"),
        apiRequest<LiveLocation[]>("/api/tracking/live"),
      ]);
      setVehicles(vehicleData);
      setDrivers(driverData);
      setGeofences(geofenceData);
      setLiveLocations(Object.fromEntries(liveData.map((v) => [v.vehicleId, v.lastLocation])));
    } catch (err: any) {
      setError(err.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddVehicle(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiRequest("/api/vehicles", {
        method: "POST",
        body: JSON.stringify({ plateNumber, make, model, deviceId: deviceId || undefined, vehicleType }),
      });
      setPlateNumber("");
      setMake("");
      setModel("");
      setDeviceId("");
      setVehicleType("car");
      await loadAll();
    } catch (err: any) {
      setFormError(err.message || "Failed to add vehicle");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignDriver(vehicleId: string, driverId: string) {
    setAssigningId(vehicleId);
    try {
      await apiRequest(`/api/vehicles/${vehicleId}`, {
        method: "PUT",
        body: JSON.stringify({ driverId: driverId || null }),
      });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to assign driver");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
        {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <>
            <p className="text-xs text-teal-600 px-5 pt-4">
              Every vehicle on your account, its current status, and assigned driver.
            </p>
            <table className="w-full text-sm mt-2">
            <thead className="bg-gray-50 text-black text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Plate</th>
                <th className="text-left px-5 py-3 font-bold">Make / Model</th>
                <th className="text-left px-5 py-3 font-bold">Status</th>
                <th className="text-left px-5 py-3 font-bold">Zone</th>
                <th className="text-left px-5 py-3 font-bold">Driver</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    No vehicles added yet.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v._id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <Link
                        href={`${basePath}/${v._id}`}
                        className="inline-block w-28 cursor-pointer rounded-md bg-blue-950 px-3 py-1.5 text-center text-[11px] font-bold text-white"
                      >
                        {v.plateNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-blue-950">
                      {[v.make, v.model].filter(Boolean).join(" ") || "-"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusStyles[v.status]}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <ZoneStatusBadge lastLocation={liveLocations[v._id]} geofences={geofences} />
                    </td>

<td className="px-5 py-3">
  {canAssignDriver ? (
    <div className="flex items-center gap-2">
      <select
        value={v.driverId?._id || ""}
        disabled={assigningId === v._id}
        onChange={(e) => handleAssignDriver(v._id, e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-teal-400"
      >
        <option value="">Unassigned</option>
        {drivers.map((d) => (
          <option key={d._id} value={d._id}>
            {d.fullName}
          </option>
        ))}
      </select>
      {!v.driverId && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
          No driver
        </span>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <span className="text-gray-600">{v.driverId ? v.driverId.fullName : "Unassigned"}</span>
      {!v.driverId && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
          No driver
        </span>
      )}
    </div>
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

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 h-fit">
        <h3 className="text-sm font-medium text-gray-700">Add a vehicle</h3>
        <p className="text-xs text-teal-600 mt-0.5 mb-4">Register a vehicle to start tracking it.</p>
        <form onSubmit={handleAddVehicle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plate number</label>
            <input
              type="text"
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="KDA 123A"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Make</label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Toyota"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Hiace"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle type</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            >
              <option value="car">Car</option>
              <option value="van">Van</option>
              <option value="truck">Truck</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Device ID <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="TRK-001"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
          >
            {isSubmitting ? "Adding…" : "Add vehicle"}
          </button>
        </form>
      </div>
    </div>
  );
}











