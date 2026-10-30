"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import StatCard from "../../components/StatCard";
import CircleStat from "../../components/CircleStat";
import BarChartCard from "../../components/BarChartCard";
import FullPageLoading from "@/app/components/FullPageLoading";
import { usePageHeader } from "../../components/DashboardShell";
import { CompanyRecord } from "../../types/auth";

interface AnalyticsData {
  totals: {
    totalCompanies: number;
    activeCompanies: number;
    pendingCompanies: number;
    suspendedCompanies: number;
    totalVehicles: number;
    activeVehicles: number;
    totalUsers: number;
  };
  vehiclesPerCompany: { name: string; count: number }[];
  growth: { name: string; companies: number }[];
}

const statusStyles: Record<string, string> = {
  active: "bg-teal-50 text-teal-600 border-teal-200",
  pending: "bg-orange-50 text-orange-600 border-orange-200",
  suspended: "bg-gray-100 text-gray-500 border-gray-200",
};

// Same badge colours used for plans on the Billing page.
const planStyles: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600 border-gray-200",
  basic: "bg-blue-50 text-blue-600 border-blue-200",
  pro: "bg-teal-50 text-teal-600 border-teal-200",
  enterprise: "bg-orange-50 text-orange-600 border-orange-200",
};

export default function PlatformDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const statsNode = useMemo(() => {
    if (!analytics) return undefined;
    const { totals } = analytics;
    return (
      <div className="grid grid-cols-2 gap-3 h-full">
        <StatCard label="Total companies" value={totals.totalCompanies} accent="blue" description="Companies registered on the platform" />
        <StatCard label="Total vehicles" value={totals.totalVehicles} accent="green" description="Vehicles across all companies" />
        <StatCard label="Total users" value={totals.totalUsers} accent="green" description="Admins and drivers combined" />
        <StatCard label="Pending approval" value={totals.pendingCompanies} accent="orange" description="Companies awaiting review" />
      </div>
    );
  }, [analytics]);

  usePageHeader("Platform overview", "Your platform, your network.", statsNode);

  function loadAll() {
    setLoading(true);
    Promise.all([
      apiRequest<AnalyticsData>("/api/analytics/platform"),
      apiRequest<CompanyRecord[]>("/api/companies"),
    ])
      .then(([analyticsData, companyData]) => {
        setAnalytics(analyticsData);
        setCompanies(companyData);
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(err.message || "Failed to load dashboard data");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) return <FullPageLoading label="Loading dashboard" />;
  if (loadError || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-red-600 mb-4">{loadError || "Failed to load dashboard data."}</p>
        <button
          onClick={loadAll}
          className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Retry
        </button>
      </div>
    );
  }

  const { totals, vehiclesPerCompany, growth } = analytics;

  const activeCompanyPct = totals.totalCompanies
    ? Math.round((totals.activeCompanies / totals.totalCompanies) * 100)
    : 0;
  const activeVehiclePct = totals.totalVehicles
    ? Math.round((totals.activeVehicles / totals.totalVehicles) * 100)
    : 0;

  const pendingCompanies = companies.filter((c) => c.status === "pending").slice(0, 5);
  const recentCompanies = [...companies]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div>
      {/* Recently registered companies */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Recently registered</h2>
          <Link href="/platform/companies" className="rounded bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600">
            View all
          </Link>
        </div>
        <p className="text-xs text-teal-600 mb-3">The 5 most recently signed-up companies</p>
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
          {recentCompanies.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No companies registered yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recentCompanies.map((c) => (
                  <tr key={c._id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/platform/companies/${c._id}`}
                        className="inline-block cursor-pointer rounded bg-blue-950 px-3 py-1.5 text-[12px] font-medium text-white"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${
                          planStyles[c.subscriptionPlan] || "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {c.subscriptionPlan}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusStyles[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2">
          <BarChartCard
            title="Vehicles per company"
            description="How fleet size compares across your companies"
            data={vehiclesPerCompany.map((v) => ({ name: v.name, vehicles: v.count }))}
            dataKey="vehicles"
            color="#e16d00"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CircleStat percentage={activeCompanyPct} label="Companies active" color="#0e4f27" description="Share of companies in active status" />
          <CircleStat percentage={activeVehiclePct} label="Vehicles active" color="#0e4f27" description="Share of vehicles currently active" />
        </div>
      </div>

      {/* Growth chart */}
      <div className="mb-4">
        <BarChartCard
          title="New companies — last 6 months"
          description="Sign-ups per month across the platform"
          data={growth}
          dataKey="companies"
          color="#0e4f27"
        />
      </div>

      {/* Pending approvals — needs attention */}
      {pendingCompanies.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900">Needs approval</h2>
            <Link href="/platform/companies" className="rounded bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600">
              View all
            </Link>
          </div>
          <p className="text-xs text-teal-600 mb-3">Companies waiting on a decision, oldest signups included</p>
          <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {pendingCompanies.map((c) => (
                  <tr key={c._id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/platform/companies/${c._id}`}
                        className="inline-block cursor-pointer rounded bg-blue-950 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusStyles[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}