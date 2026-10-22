"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { VehicleRecord, DriverRecord, GeofenceRecord } from "../types/auth";
import { VEHICLE_TYPES } from "../lib/vehicleTypes";
import Skeleton from "./Skeleton";
import ZoneStatusBadge from "./ZoneStatusBadge";
import WheelIcon from "./WheelIcon";

interface BulkImportResultRow {
  row: number;
  plateNumber: string;
  status: "created" | "failed";
  error?: string;
}
interface BulkImportResult {
  createdCount: number;
  failedCount: number;
  results: BulkImportResultRow[];
}

function downloadVehicleTemplate() {
  const csv =
    "plateNumber,make,model,vehicleType,deviceId,avgConsumptionLPer100Km\nKDA 123A,Toyota,Hiace,van,TRK-001,12\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vehicles-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

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
  canAdd = true,
  canDelete = true,
}: {
  basePath?: string;
  canAssignDriver?: boolean;
  canAdd?: boolean;
  canDelete?: boolean;
}) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation["lastLocation"]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [mileage, setMileage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

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
        body: JSON.stringify({
          plateNumber,
          make,
          model,
          deviceId: deviceId || undefined,
          vehicleType,
          avgConsumptionLPer100Km: mileage ? parseFloat(mileage) : undefined,
        }),
      });
      setPlateNumber("");
      setMake("");
      setModel("");
      setDeviceId("");
      setVehicleType("car");
      setMileage("");
      await loadAll();
    } catch (err: any) {
      setFormError(err.message || "Failed to add vehicle");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImportVehicles(e: FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setImportError(null);
    setImportResult(null);
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const result = await apiRequest<BulkImportResult>("/api/vehicles/bulk-import", {
        method: "POST",
        body: formData,
      });
      setImportResult(result);
      setImportFile(null);
      await loadAll();
    } catch (err: any) {
      setImportError(err.message || "Failed to import vehicles");
    } finally {
      setIsImporting(false);
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

  async function handleDelete(vehicleId: string, plateNumber: string) {
    if (!confirm(`Delete vehicle "${plateNumber}"? This can't be undone.`)) return;
    setDeleteError(null);
    setDeletingId(vehicleId);
    try {
      await apiRequest(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
      await loadAll();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete vehicle");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className={`${canAdd ? "lg:col-span-2" : "lg:col-span-3"} bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden`}>
        {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <>
            <p className="text-xs text-teal-600 px-5 pt-4">
              Every vehicle on your account, its current status, and assigned driver.
            </p>
            {deleteError && (
              <div className="mx-5 mt-3 flex items-start justify-between gap-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
                <span>{deleteError}</span>
                <button onClick={() => setDeleteError(null)} className="shrink-0 font-medium hover:underline">
                  Dismiss
                </button>
              </div>
            )}
            <table className="w-full text-sm mt-2">
            <thead className="bg-gray-50 text-black text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Plate</th>
                <th className="text-left px-5 py-3 font-bold">Make / Model</th>
                <th className="text-left px-5 py-3 font-bold">Status</th>
                <th className="text-left px-5 py-3 font-bold">Zone</th>
                <th className="text-left px-5 py-3 font-bold">Driver</th>
                {canDelete && <th className="text-left px-5 py-3 font-bold"></th>}
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 6 : 5} className="px-5 py-8 text-center text-gray-400">
                    No vehicles added yet.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v._id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <Link
                        href={`${basePath}/${v._id}`}
                        className="inline-flex items-center gap-2 text-[11px] font-bold text-blue-950 hover:text-teal-600"
                      >
                        <WheelIcon size={20} className="spin-slow shrink-0" />
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
        className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-teal-400"
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
{canDelete && (
  <td className="px-5 py-3">
    <button
      onClick={() => handleDelete(v._id, v.plateNumber)}
      disabled={deletingId === v._id}
      className="text-xs text-red-500 hover:underline disabled:opacity-60"
    >
      {deletingId === v._id ? "Deleting…" : "Delete"}
    </button>
  </td>
)}

                  </tr>
                ))
              )}
            </tbody>
          </table>
          </>
        )}
      </div>

      {canAdd && (
      <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5 h-fit">
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
              className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Make</label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Toyota"
              className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Hiace"
              className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle type</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
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
              className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mileage — fuel use (L/100km) <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="12 (default if left blank)"
              className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
            <p className="text-xs text-gray-400 mt-1">Used to estimate fuel cost for routes and trips.</p>
          </div>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
          >
            {isSubmitting ? "Adding…" : "Add vehicle"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <h3 className="text-sm font-medium text-gray-700">Import from a spreadsheet</h3>
        <p className="text-xs text-teal-600 mt-0.5 mb-3">
          Add many vehicles at once from an .xlsx or .csv file.{" "}
          <button type="button" onClick={downloadVehicleTemplate} className="underline hover:text-teal-700">
            Download template
          </button>
        </p>
        <form onSubmit={handleImportVehicles} className="space-y-3">
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />

          {importError && <p className="text-xs text-red-600">{importError}</p>}

          <button
            type="submit"
            disabled={isImporting || !importFile}
            className="w-full py-2 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
          >
            {isImporting ? "Importing…" : "Import vehicles"}
          </button>
        </form>

        {importResult && (
          <div className="mt-3 rounded border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-700">
              {importResult.createdCount} added
              {importResult.failedCount > 0 ? `, ${importResult.failedCount} failed` : ""}
            </p>
            {importResult.failedCount > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-red-600">
                {importResult.results
                  .filter((r) => r.status === "failed")
                  .map((r) => (
                    <li key={r.row}>
                      Row {r.row}
                      {r.plateNumber ? ` (${r.plateNumber})` : ""}: {r.error}
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











