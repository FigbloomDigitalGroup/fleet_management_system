"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import StatCard from "../../components/StatCard";
import BarChartCard from "../../components/BarChartCard";
import {
  CompanyRecord,
  VehicleRecord,
  DriverRecord,
  AdminRecord,
  TripRecord,
  AlertRecord,
} from "../../types/auth";

const FleetMap = dynamic(() => import("../../components/FleetMap"), { ssr: false });

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CircleStat({ percentage, label, color }: { percentage: number; label: string; color: string }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.max(0, Math.min(100, percentage)) / 100) * circumference;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80" aria-label={`${percentage}% ${label}`}>
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-900">
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

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard…</p>;

  const vehicleCounts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {company?.name ? `${company.name} overview` : "Dashboard"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Signed in as {user?.email}</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total vehicles" value={vehicleCounts.total} accent="green" />
        <StatCard label="Drivers" value={drivers.length} accent="green" />
        <StatCard label="Admins" value={admins.length} accent="green" />
        <StatCard label="Unresolved alerts" value={unresolvedAlerts.length} accent="orange" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <BarChartCard title="Trips — last 7 days" data={tripsPerDay} dataKey="trips" color="#fb923c" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CircleStat percentage={activePct} label="Fleet active" color="#4ade80" />
          <CircleStat
            percentage={vehicleCounts.total ? Math.round((vehicleCounts.offline / vehicleCounts.total) * 100) : 0}
            label="Offline"
            color="#9ca3af"
          />
        </div>
      </div>

      {/* Live map section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Live Map</h2>
          <Link href="/company/live-map" className="text-sm text-green-600 hover:underline">
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
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Recent alerts</h2>
          <Link href="/company/alerts" className="text-sm text-green-600 hover:underline">
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
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {a.vehicleId?.plateNumber || "—"}
                    </td>
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
    </div>
  );
}