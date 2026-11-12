"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiActivity } from "react-icons/fi";
import { useFleetTheme } from "../context/FleetThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAdminAccess } from "../lib/adminAccess";
import { apiRequest } from "../lib/api";
import CircleStat from "./CircleStat";
import BarChartCard from "./BarChartCard";
import DonutChartCard from "./DonutChartCard";
import LineChartCard from "./LineChartCard";
import FullPageLoading from "./FullPageLoading";
import MapMetricsCard from "./MapMetricsCard";
import FleetMiniMap from "./FleetMiniMap";
import WheelIcon from "./WheelIcon";
import OverviewMetrics from "./reports/OverviewMetrics";
import GettingStarted from "./GettingStarted";
import UpgradeOffer, { shouldShowOffer } from "./UpgradeOffer";
import { usePageHeader } from "./PageHeader";
import { routeDistanceKm, estimateFuelRangeLiters } from "../lib/routeEstimate";
import { routeStatusBadge } from "../lib/routeStatus";
import { AgentSummary, CompanyRecord, DailyStatPoint, LiveVehicleRecord, RouteRecord, TripRecord, VehicleRecord } from "../types/auth";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The Overview for company owners (/company) and fleet admins (/admin).
// First run: the Getting started checklist and one card that says what will
// appear here and the next step, instead of a wall of empty charts. Once
// vehicles report or trips exist: headline numbers, a small live map, the
// charts that have something in them, recent trips and routes.
export default function FleetOverview({ basePath }: { basePath: "/company" | "/admin" }) {
  const { user } = useAuth();
  const { canManageFleet } = useAdminAccess();
  const isOwner = user?.role === "COMPANY_OWNER";
  const { colors } = useFleetTheme();

  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [live, setLive] = useState<LiveVehicleRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStatPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  usePageHeader("Overview", "Your fleet today, at a glance");

  useEffect(() => {
    async function loadAll() {
      try {
        const [vehicleData, liveData, tripData, routeData] = await Promise.all([
          apiRequest<VehicleRecord[]>("/api/vehicles"),
          apiRequest<LiveVehicleRecord[]>("/api/tracking/live"),
          apiRequest<TripRecord[]>("/api/trips"),
          apiRequest<RouteRecord[]>("/api/routes"),
        ]);
        setVehicles(vehicleData);
        setLive(liveData);
        setTrips(tripData);
        setRoutes(routeData);
        setHasLoadedOnce(true);
        setLoadError(null);
      } catch (err) {
        // Only a hard failure before anything was shown; a missed poll
        // afterwards just flags it quietly.
        setLoadError((err as Error).message || "Couldn't refresh the overview");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    const interval = setInterval(loadAll, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    apiRequest<AgentSummary>("/api/agent/summary").then(setAgentSummary).catch(() => {});
    apiRequest<DailyStatPoint[]>("/api/companies/me/stats/daily").then(setDailyStats).catch(() => {});
    apiRequest<CompanyRecord>("/api/companies/me").then(setCompany).catch(() => {});
  }, []);

  if (loading) return <FullPageLoading label="Loading overview" />;

  if (loadError && !hasLoadedOnce) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="mb-4 text-sm text-red-600">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Try again
        </button>
      </div>
    );
  }

  const counts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
    withDriver: vehicles.filter((v) => v.driverId).length,
  };
  const reporting = live.filter((v) => v.lastLocation);
  const hasData = trips.length > 0 || reporting.length > 0;
  const firstUnconnected = live.find((v) => !v.lastLocation) ?? live[0];
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const tripsPerDay = last7Days.map((day) => ({
    name: dayNames[day.getDay()],
    trips: trips.filter((t) => new Date(t.startTime).toDateString() === day.toDateString()).length,
  }));
  const agentActivity =
    agentSummary?.dailyActivity.map((d) => ({ name: d.label, vehicleChecks: d.vehicleChecks, anomalies: d.anomalies })) ?? [];
  const agentHasActivity = agentActivity.some((d) => d.vehicleChecks > 0 || d.anomalies > 0);

  const showOffer = !!user && shouldShowOffer({ isOwner: isOwner && !user.support, plan: company?.subscriptionPlan ?? null, vehicleCount: counts.total });

  // The one next step while there's nothing to chart yet.
  const nextStep =
    counts.total === 0
      ? {
          text: "Add your first vehicle. Once it reports its location, trips, distance, fuel and alerts appear here.",
          action: canManageFleet ? { label: "Add a vehicle", href: `${basePath}/vehicles#add-vehicle` } : null,
        }
      : {
          text: `You have ${counts.total} ${counts.total === 1 ? "vehicle" : "vehicles"}, but none has reported a location yet. Connect a GPS tracker or the driver's phone and this page fills in by itself.`,
          action:
            canManageFleet && firstUnconnected
              ? { label: `Connect tracking for ${firstUnconnected.plateNumber}`, href: `${basePath}/vehicles/${firstUnconnected.vehicleId}#connect-tracking` }
              : null,
        };

  return (
    <div>
      {loadError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
          Couldn&apos;t refresh just now, so you&apos;re seeing the last loaded numbers. ({loadError})
        </div>
      )}

      <GettingStarted />
      {showOffer && user && <UpgradeOffer userId={user.id} />}

      {!hasData ? (
        <section className="mb-4 rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <FiActivity size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-gray-900">Your fleet&apos;s numbers will show here</h2>
              <p className="mt-1 text-sm text-gray-600">{nextStep.text}</p>
              <p className="mt-1 text-xs text-gray-500">
                You&apos;ll see: where each vehicle is, trips per day, distance and fuel, driver scores and alerts.
              </p>
            </div>
            {nextStep.action && (
              <Link
                href={nextStep.action.href}
                className="shrink-0 rounded bg-orange-500 px-4 py-2 text-center text-sm font-medium text-white hover:bg-orange-600"
              >
                {nextStep.action.label}
              </Link>
            )}
          </div>
        </section>
      ) : (
        <>
          <OverviewMetrics basePath={basePath} />

          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="[&>div]:h-full">
              <FleetMiniMap vehicles={live} liveMapHref={`${basePath}/live-map`} />
            </div>
            <div className="[&>div]:h-full">
              <DonutChartCard
                title="Fleet status"
                description="How your vehicles are split across statuses"
                data={[
                  { name: "Active", value: counts.active, color: "#50a86a" },
                  { name: "Idle", value: counts.idle, color: "#ffa049" },
                  { name: "Offline", value: counts.offline, color: "#000000" },
                  { name: "Maintenance", value: counts.maintenance, color: "#f87171" },
                ]}
              />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <BarChartCard
              title="Trips: last 7 days"
              description="Number of trips started each day"
              data={tripsPerDay}
              dataKey="trips"
              size="lg"
            />
            <MapMetricsCard dailyStats={dailyStats} />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <CircleStat percentage={pct(counts.active)} label="Fleet active" color={colors.mainSoft} description="Vehicles on the move now" />
            <CircleStat
              percentage={pct(counts.withDriver)}
              label="Vehicles with a driver"
              color={colors.main}
              description={`${counts.withDriver} of ${counts.total} have a driver assigned`}
            />
          </div>

          {agentHasActivity && (
            <div className="mb-4 h-80">
              <LineChartCard
                title="AI checks: last 7 days"
                description="Vehicle checks and anomalies the AI agent found, per day"
                data={agentActivity}
                lines={[
                  { dataKey: "vehicleChecks", label: "Vehicle checks", color: colors.mainSoft },
                  { dataKey: "anomalies", label: "Anomalies", color: colors.accent },
                ]}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 lg:flex-row">
            <RecentTrips trips={trips} basePath={basePath} />
            <RoutesTable routes={routes} vehicles={vehicles} basePath={basePath} />
          </div>
        </>
      )}
    </div>
  );
}

function SectionHead({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <Link href={href} className="text-xs font-semibold text-teal-700 hover:underline">
          View all
        </Link>
      </div>
      <p className="mb-3 text-xs text-teal-600">{text}</p>
    </>
  );
}

function RecentTrips({ trips, basePath }: { trips: TripRecord[]; basePath: string }) {
  return (
    <div className="min-w-0 flex-1">
      <SectionHead title="Recent trips" text="The 5 most recently started trips" href={`${basePath}/trips`} />
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        {trips.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No trips recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {trips.slice(0, 5).map((t) => (
                <tr key={t._id} className="border-t border-gray-100 first:border-t-0">
                  <td className="px-4 py-3 text-xs font-bold text-gray-900">
                    <Link href={`${basePath}/trips/${t._id}`} className="inline-flex items-center gap-2 hover:text-teal-600">
                      <WheelIcon size={16} className="spin-slow shrink-0" />
                      {t.vehicleId?.plateNumber || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.driverId?.fullName || "No driver"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(t.startTime).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.distanceKm ? `${t.distanceKm.toFixed(1)} km` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RoutesTable({ routes, vehicles, basePath }: { routes: RouteRecord[]; vehicles: VehicleRecord[]; basePath: string }) {
  return (
    <div className="min-w-0 flex-1">
      <SectionHead title="Routes" text="Distance and estimated fuel per planned route" href={`${basePath}/routes`} />
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        {routes.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No routes created yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {routes.slice(0, 5).map((r) => {
                const vehicleIdStr = typeof r.vehicleId === "object" ? r.vehicleId?._id : r.vehicleId;
                const vehicle = vehicles.find((v) => v._id === vehicleIdStr);
                const distanceKm = routeDistanceKm(r.waypoints);
                const fuel = estimateFuelRangeLiters(distanceKm, vehicle?.avgConsumptionLPer100Km);
                const badge = routeStatusBadge(r);
                return (
                  <tr key={r._id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-3 text-xs font-bold text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {vehicleIdStr ? (
                        <Link href={`${basePath}/vehicles/${vehicleIdStr}`} className="inline-flex items-center gap-2 hover:text-teal-600">
                          <WheelIcon size={16} className="spin-slow shrink-0" />
                          {typeof r.vehicleId === "object" ? r.vehicleId?.plateNumber : "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{distanceKm.toFixed(1)} km</td>
                    <td className="px-4 py-3 text-gray-600">
                      {fuel.min.toFixed(1)}–{fuel.max.toFixed(1)} L
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-1 text-xs ${badge.className}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
