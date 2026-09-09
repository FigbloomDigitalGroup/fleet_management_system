/*
"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../lib/api";
import { VehicleRecord } from "../types/auth";

const statusStyles: Record<string, string> = {
  active: "bg-green-50 text-green-600 border-green-200",
  idle: "bg-orange-50 text-orange-600 border-orange-200",
  offline: "bg-gray-100 text-gray-500 border-gray-200",
  maintenance: "bg-red-50 text-red-600 border-red-200",
};

export default function VehiclesList() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadVehicles() {
    try {
      const data = await apiRequest<VehicleRecord[]>("/api/vehicles");
      setVehicles(data);
    } catch (err: any) {
      setError(err.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  async function handleAddVehicle(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await apiRequest("/api/vehicles", {
        method: "POST",
        body: JSON.stringify({ plateNumber, make, model, deviceId: deviceId || undefined }),
      });
      setPlateNumber("");
      setMake("");
      setModel("");
      setDeviceId("");
      await loadVehicles();
    } catch (err: any) {
      setFormError(err.message || "Failed to add vehicle");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
  
      <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading && <p className="text-sm text-gray-500 p-5">Loading…</p>}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-black text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Plate</th>
                <th className="text-left px-5 py-3 font-bold">Make / Model</th>
                <th className="text-left px-5 py-3 font-bold">Status</th>
                <th className="text-left px-5 py-3 font-bold">Driver</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                    No vehicles added yet.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v._id} className="border-t border-gray-100">
                    <td className="px-5 py-3 font-medium text-gray-900">{v.plateNumber}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {[v.make, v.model].filter(Boolean).join(" ") || "-"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusStyles[v.status]}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {v.driverId ? v.driverId.fullName : "Unassigned"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>


      <div className="bg-white rounded-lg p-5 h-fit">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Add a vehicle</h3>
        <form onSubmit={handleAddVehicle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plate number</label>
            <input
              type="text"
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="KDA 123A"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Make</label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Toyota"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Hiace"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
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
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
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
*/


"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { VehicleRecord, DriverRecord } from "../types/auth";
import Skeleton from "./Skeleton";

const statusStyles: Record<string, string> = {
  active: "bg-green-50 text-green-600 border-green-200",
  idle: "bg-orange-50 text-orange-600 border-orange-200",
  offline: "bg-gray-100 text-gray-500 border-gray-200",
  maintenance: "bg-red-50 text-red-600 border-red-200",
};

export default function VehiclesList({
  basePath = "/admin/vehicles",
  canAssignDriver = true,
}: {
  basePath?: string;
  canAssignDriver?: boolean;
}) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [vehicleData, driverData] = await Promise.all([
        apiRequest<VehicleRecord[]>("/api/vehicles"),
        apiRequest<DriverRecord[]>("/api/users/drivers"),
      ]);
      setVehicles(vehicleData);
      setDrivers(driverData);
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
        body: JSON.stringify({ plateNumber, make, model, deviceId: deviceId || undefined }),
      });
      setPlateNumber("");
      setMake("");
      setModel("");
      setDeviceId("");
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
      <div className="lg:col-span-2 bg-white rounded-lg overflow-hidden">
        {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-black text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Plate</th>
                <th className="text-left px-5 py-3 font-bold">Make / Model</th>
                <th className="text-left px-5 py-3 font-bold">Status</th>
                <th className="text-left px-5 py-3 font-bold">Driver</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                    No vehicles added yet.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v._id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <Link
                        href={`${basePath}/${v._id}`}
                        className="inline-block w-28 cursor-pointer rounded-md bg-blue-950 px-3 py-1.5 text-center text-sm font-medium text-white"
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
                      {canAssignDriver ? (
                        <select
                          value={v.driverId?._id || ""}
                          disabled={assigningId === v._id}
                          onChange={(e) => handleAssignDriver(v._id, e.target.value)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-green-600"
                        >
                          <option value="">Unassigned</option>
                          {drivers.map((d) => (
                            <option key={d._id} value={d._id}>
                              {d.fullName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="inline-block rounded-full bg-orange-500 px-3 py-1 text-xs font-medium"
                          style={{ color: "#ffffff" }}
                        >
                          {v.driverId ? v.driverId.fullName : "Unassigned"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-lg p-5 h-fit">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Add a vehicle</h3>
        <form onSubmit={handleAddVehicle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plate number</label>
            <input
              type="text"
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="KDA 123A"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Make</label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Toyota"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Hiace"
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
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
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
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






