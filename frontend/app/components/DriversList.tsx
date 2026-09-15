/*
"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../lib/api";
import { DriverRecord } from "../types/auth";

export default function DriversList({ canAdd = false }: { canAdd?: boolean }) {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadDrivers() {
    try {
      const data = await apiRequest<DriverRecord[]>("/api/users/drivers");
      setDrivers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  async function handleAddDriver(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiRequest("/api/auth/users", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName, role: "DRIVER" }),
      });
      setFullName("");
      setEmail("");
      setPassword("");
      await loadDrivers();
    } catch (err: any) {
      setFormError(err.message || "Failed to add driver");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={canAdd ? "grid lg:grid-cols-3 gap-4" : ""}>

      <div className={`${canAdd ? "lg:col-span-2" : ""} bg-white rounded-lg overflow-hidden`}>
        {loading && <p className="text-sm text-gray-500 p-5">Loading…</p>}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Email</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                    No drivers added yet.
                  </td>
                </tr>
              ) : (
                drivers.map((d) => (
                  <tr key={d._id} className="border-t border-gray-100">
                    <td className="px-5 py-3 font-medium text-gray-900">{d.fullName}</td>
                    <td className="px-5 py-3 text-gray-600">{d.email}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-1 rounded-full border bg-green-50 text-green-600 border-green-200">
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

   
      {canAdd && (
        <div className="bg-white rounded-lg p-5 h-fit">
          <h3 className="text-sm font-medium text-gray-700">Add a driver</h3>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Creates a driver login they can use on their phone.</p>
          <form onSubmit={handleAddDriver} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
              />
            </div>

            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmitting ? "Adding…" : "Add driver"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
  */


"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../lib/api";
import { DriverRecord, VehicleRecord } from "../types/auth";
import Skeleton from "./Skeleton";

export default function DriversList({ canAdd = false, canAssignVehicle = false }: { canAdd?: boolean; canAssignVehicle?: boolean }) {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [driverData, vehicleData] = await Promise.all([
        apiRequest<DriverRecord[]>("/api/users/drivers"),
        apiRequest<VehicleRecord[]>("/api/vehicles"),
      ]);
      setDrivers(driverData);
      setVehicles(vehicleData);
    } catch (err: any) {
      setError(err.message || "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Find which vehicle (if any) is currently assigned to a given driver
  function vehicleForDriver(driverId: string) {
    return vehicles.find((v) => v.driverId?._id === driverId) || null;
  }

  async function handleAddDriver(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiRequest("/api/auth/users", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName, role: "DRIVER" }),
      });
      setFullName("");
      setEmail("");
      setPassword("");
      await loadAll();
    } catch (err: any) {
      setFormError(err.message || "Failed to add driver");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Assign this driver to a vehicle. If they're already on another vehicle,
  // that old assignment is cleared first (a driver can only drive one vehicle at a time).
  async function handleAssignVehicle(driverId: string, newVehicleId: string) {
    setAssigningId(driverId);
    try {
      const currentVehicle = vehicleForDriver(driverId);
      if (currentVehicle && currentVehicle._id !== newVehicleId) {
        await apiRequest(`/api/vehicles/${currentVehicle._id}`, {
          method: "PUT",
          body: JSON.stringify({ driverId: null }),
        });
      }
      if (newVehicleId) {
        await apiRequest(`/api/vehicles/${newVehicleId}`, {
          method: "PUT",
          body: JSON.stringify({ driverId }),
        });
      }
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to assign vehicle");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div className={canAdd ? "grid lg:grid-cols-3 gap-4" : ""}>
      <div className={`${canAdd ? "lg:col-span-2" : ""} bg-white rounded-lg overflow-hidden`}>
        {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <>
            <p className="text-xs text-gray-400 px-5 pt-4">
              Everyone with driver access on your account and the vehicle they're currently on.
            </p>
            <table className="w-full text-sm mt-2">
            <thead className="bg-gray-50 text-black text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Name</th>
                <th className="text-left px-5 py-3 font-bold">Email</th>
                <th className="text-left px-5 py-3 font-bold">Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                    No drivers added yet.
                  </td>
                </tr>
              ) : (
                drivers.map((d) => {
                  const assigned = vehicleForDriver(d._id);
                  return (
                    <tr key={d._id} className="border-t border-gray-100">
                      <td className="px-5 py-3 font-medium text-blue-950">{d.fullName}</td>
                      <td className="px-5 py-3 text-blue-950">{d.email}</td>
                      <td className="px-5 py-3">
                        {canAssignVehicle ? (
                          <select
                            value={assigned?._id || ""}
                            disabled={assigningId === d._id}
                            onChange={(e) => handleAssignVehicle(d._id, e.target.value)}
                            className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-green-600"
                          >
                            <option value="">No vehicle</option>
                            {vehicles.map((v) => (
                              <option key={v._id} value={v._id}>
                                {v.plateNumber}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-blue-950">
                            {assigned ? assigned.plateNumber : "No vehicle"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </>
        )}
      </div>

      {canAdd && (
        <div className="bg-white rounded-lg p-5 h-fit">
          <h3 className="text-sm font-medium text-gray-700">Add a driver</h3>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Creates a driver login they can use on their phone.</p>
          <form onSubmit={handleAddDriver} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
              />
            </div>

            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmitting ? "Adding…" : "Add driver"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}













