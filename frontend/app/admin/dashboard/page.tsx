"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import StatCard from "../../components/StatCard";
import CircleStat from "../../components/CircleStat";
import BarChartCard from "../../components/BarChartCard";
import DonutChartCard from "../../components/DonutChartCard";
import LineChartCard from "../../components/LineChartCard";
import FullPageLoading from "@/app/components/FullPageLoading";
import { usePageHeader } from "../../components/DashboardShell";
import { VehicleRecord, DriverRecord, TripRecord, AlertRecord, AgentSummary } from "../../types/auth";

//const FleetMap = dynamic<{ compact?: boolean }>(() => import("../../components/FleetMap"), { ssr: false });

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminDashboard() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const vehicleCounts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
  };
  const unresolvedAlertCount = alerts.filter((a) => !a.resolved).length;

  const statsNode = useMemo(
    () => (
      <div className="grid grid-cols-2 gap-3 h-full">
        <StatCard label="Total vehicles" value={vehicleCounts.total} accent="blue" description="All vehicles on your account" />
        <StatCard label="Drivers" value={drivers.length} accent="green" description="Drivers registered to your fleet" />
        <StatCard label="Active now" value={vehicleCounts.active} accent="green" description="Vehicles currently moving" />
        <StatCard label="Unresolved alerts" value={unresolvedAlertCount} accent="orange" description="Alerts still awaiting review" />
      </div>
    ),
    [vehicleCounts.total, drivers.length, vehicleCounts.active, unresolvedAlertCount]
  );

  usePageHeader("Fleet overview", "Real-time visibility across your entire fleet.", statsNode);

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

  useEffect(() => {
    apiRequest<AgentSummary>("/api/agent/summary")
      .then(setAgentSummary)
      .catch(() => {});
  }, []);

  if (loading) return <FullPageLoading label="Loading dashboard" />;

  const activePct = vehicleCounts.total ? Math.round((vehicleCounts.active / vehicleCounts.total) * 100) : 0;
  const assignedDrivers = vehicles.filter((v) => v.driverId).length;
  const assignedPct = drivers.length ? Math.round((assignedDrivers / drivers.length) * 100) : 0;

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
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2">
          <BarChartCard
            title="Trips — last 7 days"
            description="Number of trips started each day this week"
            data={tripsPerDay}
            dataKey="trips"
            color="#ea580c"
            size="lg"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CircleStat percentage={activePct} label="Fleet active" color="#2dd4bf" description="Vehicles currently on the move" />
          <CircleStat percentage={assignedPct} label="Drivers assigned" color="#0d9488" description="Drivers with a vehicle assigned" />
        </div>
      </div>
    
      {/* Fleet status breakdown */}
<div className="mb-4 flex flex-col lg:flex-row gap-3">
  <div className="flex-1">
    <DonutChartCard
      title="Fleet status breakdown"
      description="How your vehicles are distributed across statuses"
      data={[
        { name: "Active", value: vehicleCounts.active, color: "#2dd4bf" },
        { name: "Idle", value: vehicleCounts.idle, color: "#fb923c" },
        { name: "Offline", value: vehicleCounts.offline, color: "#9ca3af" },
        { name: "Maintenance", value: vehicleCounts.maintenance, color: "#f87171" },
      ]}
    />
  </div>
<div className="flex-1">
  <LineChartCard
    title="Agent activity — last 7 days"
    description="Vehicle checks and anomalies found for your fleet, per day"
    data={
      agentSummary?.dailyActivity.map((d) => ({
        name: d.label,
        vehicleChecks: d.vehicleChecks,
        anomalies: d.anomalies,
      })) ?? []
    }
    lines={[
      { dataKey: "vehicleChecks", label: "Vehicle checks", color: "#2dd4bf" },
      { dataKey: "anomalies", label: "Anomalies", color: "#f97316" },
    ]}
  />
</div>
</div>

      {/* Recent alerts */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Recent alerts</h2>
          <Link href="/admin/alerts" className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-700">
            View all
          </Link>
        </div>
        <p className="text-xs text-teal-600 mb-3">The 5 most recent alerts across your fleet</p>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
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
                        className={`text-xs px-2 py-1 rounded-full border ${a.resolved
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
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Recent trips</h2>
          <Link href="/admin/trips" className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-700">
            View all
          </Link>
        </div>
        <p className="text-xs text-teal-600 mb-3">The 5 most recently started trips</p>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
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

