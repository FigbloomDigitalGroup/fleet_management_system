"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import StatCard from "../../components/StatCard";
import BarChartCard from "../../components/BarChartCard";
import FullPageLoading from "@/app/components/FullPageLoading";
import StatusDetailsCard from "@/app/components/StatusDetailsCard";
import { usePageHeader } from "../../components/DashboardShell";

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

interface BillingData {
    planCounts: Record<string, number>;
}


export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [billing, setBilling] = useState<BillingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [analyticsResult, billingResult] = await Promise.all([
                    apiRequest<AnalyticsData>("/api/analytics/platform"),
                    apiRequest<BillingData>("/api/billing/overview"),
                ]);
                setData(analyticsResult);
                setBilling(billingResult);
            } catch (err: any) {
                setError(err.message || "Failed to load analytics");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const statsNode = useMemo(() => {
        if (!data) return undefined;
        return (
            <div className="grid grid-cols-2 gap-3 h-full">
                <StatCard label="Total companies" value={data.totals.totalCompanies} accent="blue" description="Companies registered on the platform" />
                <StatCard label="Total vehicles" value={data.totals.totalVehicles} accent="green" description="Vehicles across all companies" />
                <StatCard label="Total users" value={data.totals.totalUsers} accent="green" description="Admins and drivers combined" />
                <StatCard label="Pending approval" value={data.totals.pendingCompanies} accent="orange" description="Companies awaiting review" />
            </div>
        );
    }, [data]);

    usePageHeader("Analytics", "Platform-wide usage across all companies", statsNode);

    if (loading) return <FullPageLoading />;
    if (error) return <p className="text-sm text-red-600">{error}</p>;
    if (!data) return null;

    const activeVehiclePct = data.totals.totalVehicles
        ? Math.round((data.totals.activeVehicles / data.totals.totalVehicles) * 100)
        : 0;

    const activeCompanyPct = data.totals.totalCompanies
        ? Math.round((data.totals.activeCompanies / data.totals.totalCompanies) * 100)
        : 0;

    return (
        <div>
            {/* Billing plan breakdown */}


            {/* Billing plan breakdown */}
            <div className="mb-4">
                <StatusDetailsCard
                    items={[
                        {
                            label: "Trial",
                            value: billing?.planCounts?.trial || 0,
                            color: "#9ca3af",
                            description: "Free trial period, limited vehicle count",
                        },
                        {
                            label: "Basic",
                            value: billing?.planCounts?.basic || 0,
                            color: "#60a5fa",
                            description: "Entry-level paid plan",
                        },
                        {
                            label: "Pro",
                            value: billing?.planCounts?.pro || 0,
                            color: "#50a86a",
                            description: "Full-featured plan for growing fleets",
                        },
                        {
                            label: "Enterprise",
                            value: billing?.planCounts?.enterprise || 0,
                            color: "#ffa049",
                            description: "Highest tier, largest fleets and custom needs",
                        },
                    ]}
                />
            </div>


            {/* Vehicles per company + active % */}
            <div className="grid lg:grid-cols-3 gap-3 mb-4">
                <div className="lg:col-span-2">
                    <BarChartCard
                        title="Vehicles per company"
                        description="How fleet size compares across your companies"
                        data={data.vehiclesPerCompany.map((v) => ({ name: v.name, vehicles: v.count }))}
                        dataKey="vehicles"
                        color="#e16d00"
                    />

                </div>
                <div className="grid grid-cols-1 gap-3">
                    <StatCard label="Companies active" value={`${activeCompanyPct}%`} accent="green" description="Share of companies in active status" />
                    <StatCard label="Vehicles active" value={`${activeVehiclePct}%`} accent="green" description="Share of vehicles currently active" />
                </div>
            </div>

            {/* Growth over time */}
            <BarChartCard
                title="New companies (last 6 months)"
                description="Sign-ups per month across the platform"
                data={data.growth}
                dataKey="companies"
                color="#0e4f27"
                size="sm"
            />
        </div>
    );
}

