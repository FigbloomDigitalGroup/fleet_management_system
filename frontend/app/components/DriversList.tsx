"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiRequest } from "../lib/api";
import { DriverRecord, VehicleRecord } from "../types/auth";
import Skeleton from "./Skeleton";
import WheelIcon from "./WheelIcon";
import PasswordInput from "./PasswordInput";

interface BulkImportResultRow {
  row: number;
  email: string;
  status: "created" | "failed";
  error?: string;
  generatedPassword?: string | null;
}
interface BulkImportResult {
  createdCount: number;
  failedCount: number;
  results: BulkImportResultRow[];
}

function downloadDriverTemplate() {
  const csv = "fullName,email,password\nJane Doe,jane@example.com,\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "drivers-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function DriversList({ canAdd = false, canAssignVehicle = false }: { canAdd?: boolean; canAssignVehicle?: boolean }) {
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/admin") ? "/admin/vehicles" : "/company/vehicles";
  const driversBasePath = pathname?.startsWith("/admin") ? "/admin/drivers" : "/company/drivers";
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

  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

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

  async function handleImportDrivers(e: FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setImportError(null);
    setImportResult(null);
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const result = await apiRequest<BulkImportResult>("/api/auth/users/bulk-import", {
        method: "POST",
        body: formData,
      });
      setImportResult(result);
      setImportFile(null);
      await loadAll();
    } catch (err: any) {
      setImportError(err.message || "Failed to import drivers");
    } finally {
      setIsImporting(false);
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
      <div className={`${canAdd ? "lg:col-span-2" : ""} bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden`}>
        {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <>
            <p className="text-xs text-teal-600 px-5 pt-4">
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
                      <td className="px-5 py-3 font-medium text-blue-950">
                        <Link href={`${driversBasePath}/${d._id}`} className="hover:text-teal-600 hover:underline">
                          {d.fullName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-blue-950">{d.email}</td>
                      <td className="px-5 py-3">
                        {canAssignVehicle ? (
                          <select
                            value={assigned?._id || ""}
                            disabled={assigningId === d._id}
                            onChange={(e) => handleAssignVehicle(d._id, e.target.value)}
                            className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-teal-600"
                          >
                            <option value="">No vehicle</option>
                            {vehicles.map((v) => (
                              <option key={v._id} value={v._id}>
                                {v.plateNumber}
                              </option>
                            ))}
                          </select>
                        ) : assigned ? (
                          <Link
                            href={`${basePath}/${assigned._id}`}
                            className="inline-flex items-center gap-2 text-xs font-bold text-blue-950 hover:text-teal-600"
                          >
                            <WheelIcon size={16} className="spin-slow shrink-0" />
                            {assigned.plateNumber}
                          </Link>
                        ) : (
                          <span className="text-xs font-bold text-blue-950">No vehicle</span>
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
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 h-fit">
          <h3 className="text-sm font-medium text-gray-700">Add a driver</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-4">Creates a driver login they can use on their phone.</p>
          <form onSubmit={handleAddDriver} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
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

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <h3 className="text-sm font-medium text-gray-700">Import from a spreadsheet</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-3">
            Add many drivers at once from an .xlsx or .csv file. Leave the password column blank to
            auto-generate one.{" "}
            <button type="button" onClick={downloadDriverTemplate} className="underline hover:text-teal-700">
              Download template
            </button>
          </p>
          <form onSubmit={handleImportDrivers} className="space-y-3">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />

            {importError && <p className="text-xs text-red-600">{importError}</p>}

            <button
              type="submit"
              disabled={isImporting || !importFile}
              className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
            >
              {isImporting ? "Importing…" : "Import drivers"}
            </button>
          </form>

          {importResult && (
            <div className="mt-3 rounded-md border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-700">
                {importResult.createdCount} added
                {importResult.failedCount > 0 ? `, ${importResult.failedCount} failed` : ""}
              </p>
              {importResult.results.some((r) => r.generatedPassword) && (
                <div className="mt-2">
                  <p className="text-[11px] text-orange-600">
                    Copy these temporary passwords now — they won't be shown again.
                  </p>
                  <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-700">
                    {importResult.results
                      .filter((r) => r.generatedPassword)
                      .map((r) => (
                        <li key={r.row}>
                          {r.email}: <span className="font-mono font-semibold">{r.generatedPassword}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {importResult.failedCount > 0 && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-red-600">
                  {importResult.results
                    .filter((r) => r.status === "failed")
                    .map((r) => (
                      <li key={r.row}>
                        Row {r.row}
                        {r.email ? ` (${r.email})` : ""}: {r.error}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}













