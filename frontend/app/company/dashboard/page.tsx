"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import StatCard from "../../components/StatCard";
import BarChartCard from "../../components/BarChartCard";
import DonutChartCard from "../../components/DonutChartCard";
import FullPageLoading from "@/app/components/FullPageLoading";
import { usePageHeader } from "../../components/DashboardShell";
import {
  CompanyRecord,
  VehicleRecord,
  DriverRecord,
  AdminRecord,
  TripRecord,
  AlertRecord,
} from "../../types/auth";
import StatusDetailsCard from "@/app/components/StatusDetailsCard";

const FleetMap = dynamic<{ compact?: boolean }>(() => import("../../components/FleetMap"), { ssr: false });

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CircleStat({ percentage, label, color }: { percentage: number; label: string; color: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.max(0, Math.min(100, percentage)) / 100) * circumference;

  return (
    <div className="bg-white rounded-lg p-4 h-full flex flex-col items-center justify-center">
      <div className="relative w-40 h-40">
        <svg className="w-40 h-40 -rotate-90" viewBox="0 0 80 80" aria-label={`${percentage}% ${label}`}>
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="14" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-gray-900">
          {percentage}%
        </span>
      </div>
      <span className="mt-2 text-sm text-gray-600">{label}</span>
    </div>
  );
}

export default function CompanyDashboard() {
  const { user } = useAuth();

  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  usePageHeader("Dashboard", `Signed in as ${user?.email}`);

  useEffect(() => {
    async function loadAll() {
      try {
        const [companyData, vehicleData, driverData, adminData, tripData, alertData] = await Promise.all([
          apiRequest<CompanyRecord>("/api/companies/me"),
          apiRequest<VehicleRecord[]>("/api/vehicles"),
          apiRequest<DriverRecord[]>("/api/users/drivers"),
          apiRequest<AdminRecord[]>("/api/users/admins"),
          apiRequest<TripRecord[]>("/api/trips"),
          apiRequest<AlertRecord[]>("/api/alerts"),
        ]);
        setCompany(companyData);
        setVehicles(vehicleData);
        setDrivers(driverData);
        setAdmins(adminData);
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

  if (loading) return <FullPageLoading />;

const vehicleCounts = {
  total: vehicles.length,
  active: vehicles.filter((v) => v.status === "active").length,
  idle: vehicles.filter((v) => v.status === "idle").length,
  offline: vehicles.filter((v) => v.status === "offline").length,
  maintenance: vehicles.filter((v) => v.status === "maintenance").length,
};

  const activePct = vehicleCounts.total ? Math.round((vehicleCounts.active / vehicleCounts.total) * 100) : 0;
  const unresolvedAlerts = alerts.filter((a) => !a.resolved);

  // Build a simple "trips per day, last 7 days" chart from the trips list already fetched
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const tripsPerDay = last7Days.map((day) => {
    const count = trips.filter((t) => {
      const tDate = new Date(t.startTime);
      return tDate.toDateString() === day.toDateString();
    }).length;
    return { name: dayNames[day.getDay()], trips: count };
  });

  return (
    <div>
      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total vehicles" value={vehicleCounts.total} accent="blue" />
        <StatCard label="Drivers" value={drivers.length} accent="green" />
        <StatCard label="Admins" value={admins.length} accent="green" />
        <StatCard label="Unresolved alerts" value={unresolvedAlerts.length} accent="orange" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2">
          <BarChartCard title="Trips — last 7 days" data={tripsPerDay} dataKey="trips" color="#ea580c" size="lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CircleStat percentage={activePct} label="Fleet active" color="#16a34a" />
          <CircleStat
            percentage={vehicleCounts.total ? Math.round((vehicleCounts.offline / vehicleCounts.total) * 100) : 0}
            label="Offline"
            color="#9ca3af"
          />
        </div>
      </div>

   {/* Fleet status breakdown */}
<div className="mb-4 flex flex-col lg:flex-row gap-3">
  <div className="flex-1">
    <DonutChartCard
      title="Fleet status breakdown"
      data={[
        { name: "Active", value: vehicleCounts.active, color: "#4ade80" },
        { name: "Idle", value: vehicleCounts.idle, color: "#fb923c" },
        { name: "Offline", value: vehicleCounts.offline, color: "#9ca3af" },
        { name: "Maintenance", value: vehicleCounts.maintenance, color: "#f87171" },
      ]}
    />
  </div>
  <StatusDetailsCard
    items={[
      { label: "Active", value: vehicleCounts.active, color: "#4ade80", description: "Currently moving, sending live GPS updates" },
      { label: "Idle", value: vehicleCounts.idle, color: "#fb923c", description: "Engine on or stationary, not actively driving" },
      { label: "Offline", value: vehicleCounts.offline, color: "#9ca3af", description: "No signal received recently from this vehicle" },
      { label: "Maintenance", value: vehicleCounts.maintenance, color: "#f87171", description: "Taken out of service for repair or servicing" },
    ]}
  />
</div>

      {/* Recent alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Recent alerts</h2>
          <Link href="/company/alerts" className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700">
            View all
          </Link>
        </div>
        <div className="bg-white rounded-lg overflow-hidden">
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No alerts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {alerts.slice(0, 5).map((a) => (
                  <tr key={a._id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {a.vehicleId?.plateNumber || "—"}
                    </td>
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
    </div>
  );
}