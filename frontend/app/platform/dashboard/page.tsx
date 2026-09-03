"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { CompanyRecord } from "../../types/auth";
import StatCard from "../../components/StatCard";

export default function PlatformDashboard() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest<CompanyRecord[]>("/api/companies");
        setCompanies(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const active = companies.filter((c) => c.status === "active").length;
  const pending = companies.filter((c) => c.status === "pending").length;
  const suspended = companies.filter((c) => c.status === "suspended").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform overview</h1>
        <p className="text-sm text-gray-500 mt-1">Across all registered companies</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total companies" value={companies.length} accent="green" />
          <StatCard label="Active" value={active} accent="green" />
          <StatCard label="Pending approval" value={pending} accent="orange" />
          <StatCard label="Suspended" value={suspended} accent="orange" />
        </div>
      )}
    </div>
  );
}



