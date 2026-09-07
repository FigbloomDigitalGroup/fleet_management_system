"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import StatCard from "../../components/StatCard";

function BarChartCard({
    title,
    data,
    dataKey,
    color,
}: {
    title: string;
    data: { name: string; [key: string]: string | number }[];
    dataKey: string;
    color: string;
}) {
    const maxValue = Math.max(...data.map((item) => Number(item[dataKey])), 1);

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">{title}</h2>
            <div className="flex h-48 items-end gap-3">
                {data.map((item) => (
                    <div key={item.name} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div
                            className="w-full rounded-t"
                            style={{
                                height: `${(Number(item[dataKey]) / maxValue) * 100}%`,
                                backgroundColor: color,
                            }}
                            title={`${item.name}: ${item[dataKey]}`}
                        />
                        <span className="w-full truncate text-center text-xs text-gray-500">{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}


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

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const result = await apiRequest<AnalyticsData>("/api/analytics/platform");
                setData(result);
            } catch (err: any) {
                setError(err.message || "Failed to load analytics");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
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
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                <p className="text-sm text-gray-500 mt-1">Platform-wide usage across all companies</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total companies" value={data.totals.totalCompanies} accent="green" />
                <StatCard label="Total vehicles" value={data.totals.totalVehicles} accent="green" />
                <StatCard label="Total users" value={data.totals.totalUsers} accent="green" />
                <StatCard label="Pending approval" value={data.totals.pendingCompanies} accent="orange" />
            </div>

            <div className="grid lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2">
                    <BarChartCard
                        title="Vehicles per company"
                        data={data.vehiclesPerCompany.map((v) => ({ name: v.name, vehicles: v.count }))}
                        dataKey="vehicles"
                        color="#fb923c"
                    />
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <StatCard label="Companies active" value={`${activeCompanyPct}%`} accent="green" />
                </div>
            </div>

            <BarChartCard
                title="New companies (last 6 months)"
                data={data.growth}
                dataKey="companies"
                color="#4ade80"
            />
        </div>
    );
}