"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import CircleStat from "../../components/CircleStat";
import BarChartCard from "../../components/BarChartCard";
import DonutChartCard from "../../components/DonutChartCard";
import LineChartCard from "../../components/LineChartCard";
import FullPageLoading from "@/app/components/FullPageLoading";
import MapMetricsCard from "../../components/MapMetricsCard";
import WheelIcon from "../../components/WheelIcon";
import { usePageHeader } from "../../components/DashboardShell";
import OverviewMetrics from "../../components/reports/OverviewMetrics";
import { routeDistanceKm, estimateFuelRangeLiters } from "../../lib/routeEstimate";
import { routeStatusBadge } from "../../lib/routeStatus";
import {
  DailyStatPoint,
  VehicleRecord,
  TripRecord,
  AgentSummary,
  RouteRecord,
} from "../../types/auth";


const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CompanyDashboard() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStatPoint[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const vehicleCounts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
  };

  usePageHeader("Fleet Overview", "Everything your fleet needs, in one place.");

  useEffect(() => {
    async function loadAll() {
      try {
        const [vehicleData, tripData, routeData] = await Promise.all([
          apiRequest<VehicleRecord[]>("/api/vehicles"),
          apiRequest<TripRecord[]>("/api/trips"),
          apiRequest<RouteRecord[]>("/api/routes"),
        ]);
        setVehicles(vehicleData);
        setTrips(tripData);
        setRoutes(routeData);
        hasLoadedOnceRef.current = true;
        setLoadError(null);
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || "Failed to refresh dashboard data");
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

  if (loadError && !hasLoadedOnceRef.current) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-red-600 mb-4">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Retry
        </button>
      </div>
    );
  }

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
      {loadError && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-600">
          Couldn't refresh dashboard data — showing the last loaded values. ({loadError})
        </div>
      )}

      <OverviewMetrics basePath="/company" />

      {/* Fleet status breakdown beside the trips chart — first thing below
          the header. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <DonutChartCard
            title="Fleet status breakdown"
            description="How your vehicles are distributed across statuses"
            data={[
              { name: "Active", value: vehicleCounts.active, color: "#50a86a" },
              { name: "Idle", value: vehicleCounts.idle, color: "#ffa049" },
              { name: "Offline", value: vehicleCounts.offline, color: "#000000" },
              { name: "Maintenance", value: vehicleCounts.maintenance, color: "#f87171" },
            ]}
          />
        </div>
        <div className="lg:col-span-2">
          <BarChartCard
            title="Trips — last 7 days"
            description="Number of trips started each day this week"
            data={tripsPerDay}
            dataKey="trips"
            color="#e16d00"
            size="lg"
          />
        </div>
      </div>

      {/* Fleet active / offline rings */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <CircleStat percentage={activePct} label="Fleet active" color="#50a86a" description="Vehicles currently on the move" />
        <CircleStat
          percentage={vehicleCounts.total ? Math.round((vehicleCounts.offline / vehicleCounts.total) * 100) : 0}
          label="Offline"
          color="#9ca3af"
          description="No recent signal received"
        />
      </div>

   {/* Agent activity on the left, Fleet on the map on the right */}
<div className="mb-4 flex flex-col lg:flex-row gap-3 lg:h-80">
  <div className="flex-1 h-80 lg:h-full">
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
        { dataKey: "vehicleChecks", label: "Vehicle checks", color: "#50a86a" },
        { dataKey: "anomalies", label: "Anomalies", color: "#ff8a12" },
      ]}
    />
  </div>
  <div className="flex-1 h-80 lg:h-full">
    <MapMetricsCard active={vehicleCounts.active} total={vehicleCounts.total} dailyStats={dailyStats} />
  </div>
</div>

      {/* Routes */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Routes</h2>
          <Link href="/company/routes" className="rounded bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600">
            View all
          </Link>
        </div>
        <p className="text-xs text-teal-600 mb-3">Distance and estimated fuel per planned route</p>
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
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