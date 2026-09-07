"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import StatCard from "../../components/StatCard";
import CircleStat from "../../components/CircleStat";
import BarChartCard from "../../components/BarChartCard";
import { VehicleRecord, DriverRecord, TripRecord, AlertRecord } from "../../types/auth";

const FleetMap = dynamic(() => import("../../components/FleetMap"), { ssr: false });

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminDashboard() {
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      try {
        const [vehicleData, driverData, tripData, alertData] = await Promise.all([
          apiRequest<VehicleRecord[]>("/api/vehicles"),
          apiRequest<DriverRecord[]>("/api/users/drivers"),
          apiRequest<TripRecord[]>("/api/trips"),
          apiRequest<AlertRecord[]>("/api/alerts"),
        ]);
        setVehicles(vehicleData);
        setDrivers(driverData);
        setTrips(tripData);
        setAlerts(alertData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard…</p>;

  const vehicleCounts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
  };

  const activePct = vehicleCounts.total ? Math.round((vehicleCounts.active / vehicleCounts.total) * 100) : 0;
  const assignedDrivers = vehicles.filter((v) => v.driverId).length;
  const assignedPct = drivers.length ? Math.round((assignedDrivers / drivers.length) * 100) : 0;
  const unresolvedAlerts = alerts.filter((a) => !a.resolved);

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const tripsPerDay = last7Days.map((day) => {
    const count = trips.filter((t) => new Date(t.startTime).toDateString() === day.toDateString()).length;
    return { name: dayNames[day.getDay()], trips: count };
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Fleet overview</h1>
        <p className="text-sm text-gray-500 mt-1">Signed in as {user?.email}</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total vehicles" value={vehicleCounts.total} accent="green" />
        <StatCard label="Drivers" value={drivers.length} accent="green" />
        <StatCard label="Active now" value={vehicleCounts.active} accent="green" />
        <StatCard label="Unresolved alerts" value={unresolvedAlerts.length} accent="orange" />
      </div>

      {/* Secondary stat cards — vehicle status breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Idle" value={vehicleCounts.idle} accent="orange" />
        <StatCard label="Offline" value={vehicleCounts.offline} accent="orange" />
        <StatCard label="Maintenance" value={vehicleCounts.maintenance} accent="orange" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <BarChartCard title="Trips — last 7 days" data={tripsPerDay} dataKey="trips" color="#fb923c" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CircleStat percentage={activePct} label="Fleet active" color="#4ade80" />
          <CircleStat percentage={assignedPct} label="Drivers assigned" color="#4ade80" />
        </div>
      </div>

      {/* Live map section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Live Map</h2>
          <Link href="/admin/live-map" className="text-sm text-green-600 hover:underline">
            View full map →
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="h-[350px]">
            <FleetMap />
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Recent alerts</h2>
          <Link href="/admin/alerts" className="text-sm text-green-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No alerts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {alerts.slice(0, 5).map((a) => (
                  <tr key={a._id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-5 py-3 font-medium text-gray-900">{a.vehicleId?.plateNumber || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{a.type.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3 text-gray-500">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${
                          a.resolved
                            ? "bg-gray-100 text-gray-500 border-gray-200"
                            : "bg-orange-50 text-orange-600 border-orange-200"
                        }`}
                      >
                        {a.resolved ? "resolved" : "open"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent trips */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Recent trips</h2>
          <Link href="/admin/trips" className="text-sm text-green-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {trips.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No trips recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {trips.slice(0, 5).map((t) => (
                  <tr key={t._id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-5 py-3 font-medium text-gray-900">{t.vehicleId?.plateNumber || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{t.driverId?.fullName || "Unassigned"}</td>
                    <td className="px-5 py-3 text-gray-500">{new Date(t.startTime).toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {t.distanceKm ? `${t.distanceKm.toFixed(1)} km` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

