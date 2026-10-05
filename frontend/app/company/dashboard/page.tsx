"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import StatCard from "../../components/StatCard";
import BarChartCard from "../../components/BarChartCard";
import DonutChartCard from "../../components/DonutChartCard";
import LineChartCard from "../../components/LineChartCard";
import FullPageLoading from "@/app/components/FullPageLoading";
import LiveMapPreview from "../../components/LiveMapPreview";
import MapMetricsCard from "../../components/MapMetricsCard";
import WheelIcon from "../../components/WheelIcon";
import { usePageHeader } from "../../components/DashboardShell";
import { routeDistanceKm, estimateFuelRangeLiters } from "../../lib/routeEstimate";
import { routeStatusBadge } from "../../lib/routeStatus";
import { formatKes } from "../../lib/pricing";
import {
  CompanyStats,
  DailyStatPoint,
  VehicleRecord,
  DriverRecord,
  AdminRecord,
  TripRecord,
  AlertRecord,
  AgentSummary,
  RouteRecord,
} from "../../types/auth";

//const FleetMap = dynamic<{ compact?: boolean }>(() => import("../../components/FleetMap"), { ssr: false });

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CircleStat({
  percentage,
  label,
  description,
  color,
}: {
  percentage: number;
  label: string;
  description?: string;
  color: string;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.max(0, Math.min(100, percentage)) / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4 h-full flex flex-col items-center justify-center">
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
      {description && <span className="text-xs text-teal-600 text-center">{description}</span>}
    </div>
  );
}

export default function CompanyDashboard() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStatPoint[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
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
        <StatCard label="Admins" value={admins.length} accent="green" description="Admin users on your account" />
        <StatCard label="Unresolved alerts" value={unresolvedAlertCount} accent="orange" description="Alerts still awaiting review" />
      </div>
    ),
    [vehicleCounts.total, drivers.length, admins.length, unresolvedAlertCount]
  );

  usePageHeader("Fleet Overview", "Everything your fleet needs, in one place.", statsNode);

  useEffect(() => {
    async function loadAll() {
      try {
        const [vehicleData, driverData, adminData, tripData, alertData, routeData] = await Promise.all([
          apiRequest<VehicleRecord[]>("/api/vehicles"),
          apiRequest<DriverRecord[]>("/api/users/drivers"),
          apiRequest<AdminRecord[]>("/api/users/admins"),
          apiRequest<TripRecord[]>("/api/trips"),
          apiRequest<AlertRecord[]>("/api/alerts"),
          apiRequest<RouteRecord[]>("/api/routes"),
        ]);
        setVehicles(vehicleData);
        setDrivers(driverData);
        setAdmins(adminData);
        setTrips(tripData);
        setAlerts(alertData);
        setRoutes(routeData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    const interval = setInterval(loadAll, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    apiRequest<AgentSummary>("/api/agent/summary")
      .then(setAgentSummary)
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest<CompanyStats>("/api/companies/me/stats")
      .then(setCompanyStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function loadDailyStats() {
      apiRequest<DailyStatPoint[]>("/api/companies/me/stats/daily")
        .then(setDailyStats)
        .catch(() => {});
    }
    loadDailyStats();
    const interval = setInterval(loadDailyStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <FullPageLoading />;

  const activePct = vehicleCounts.total ? Math.round((vehicleCounts.active / vehicleCounts.total) * 100) : 0;

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
      {/* Distance, expenses & revenue — shown first, right after the
          Fleet Overview hero + stat cards above. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard
          label="Total distance covered"
          value={`${companyStats?.totalDistanceKm ?? 0} km`}
          accent="blue"
          description="All recorded trips, all time"
        />
        <StatCard
          label="Expenses"
          value={companyStats?.estimatedExpenses === null ? "Custom plan" : formatKes(companyStats?.estimatedExpenses ?? 0)}
          accent="orange"
          description="Estimated total spent since joining"
        />
        <StatCard
          label="Fuel consumption"
          value={`${companyStats?.totalFuelConsumedLiters ?? 0} L`}
          accent="orange"
          description="Estimated from fuel sensor readings, all time"
        />
      </div>

      {/* Map metrics card + Live Map preview — share the row instead of each
          spanning the full width on their own. The map's title/button float
          over it (see LiveMapPreview) instead of sitting above it, so both
          cards use the row's full height edge to edge. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 h-80">
        <LiveMapPreview href="/company/live-map" />
        <MapMetricsCard active={vehicleCounts.active} total={vehicleCounts.total} dailyStats={dailyStats} />
      </div>

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
          <CircleStat
            percentage={vehicleCounts.total ? Math.round((vehicleCounts.offline / vehicleCounts.total) * 100) : 0}
            label="Offline"
            color="#9ca3af"
            description="No recent signal received"
          />
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

      {/* Routes */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Routes</h2>
          <Link href="/company/routes" className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600">
            View all
          </Link>
        </div>
        <p className="text-xs text-teal-600 mb-3">Distance and estimated fuel per planned route</p>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          {routes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No routes created yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {routes.slice(0, 5).map((r) => {
                  const vehicleIdStr = typeof r.vehicleId === "object" ? r.vehicleId._id : r.vehicleId;
                  const vehicle = vehicles.find((v) => v._id === vehicleIdStr);
                  const distanceKm = routeDistanceKm(r.waypoints);
                  const fuelEstimate = estimateFuelRangeLiters(distanceKm, vehicle?.avgConsumptionLPer100Km);
                  return (
                    <tr key={r._id} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-5 py-3 text-xs font-bold text-gray-900">{r.name}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {vehicleIdStr ? (
                          <Link href={`/company/vehicles/${vehicleIdStr}`} className="inline-flex items-center gap-2 hover:text-teal-600">
                            <WheelIcon size={16} className="spin-slow shrink-0" />
                            {typeof r.vehicleId === "object" ? r.vehicleId.plateNumber : "—"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{distanceKm.toFixed(1)} km</td>
                      <td className="px-5 py-3 text-gray-600">
                        {fuelEstimate.min.toFixed(1)}–{fuelEstimate.max.toFixed(1)} L
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full border ${routeStatusBadge(r).className}`}>
                          {routeStatusBadge(r).label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}