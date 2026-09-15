"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import StatCard from "../../components/StatCard";
import FullPageLoading from "@/app/components/FullPageLoading";

interface BillingCompany {
  _id: string;
  name: string;
  status: string;
  subscriptionPlan: string;
  createdAt: string;
}

const planStyles: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600 border-gray-200",
  basic: "bg-blue-50 text-blue-600 border-blue-200",
  pro: "bg-green-50 text-green-600 border-green-200",
  enterprise: "bg-orange-50 text-orange-600 border-orange-200",
};

const PLAN_OPTIONS = ["trial", "basic", "pro", "enterprise"];

export default function BillingPage() {
  const [companies, setCompanies] = useState<BillingCompany[]>([]);
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiRequest<{ companies: BillingCompany[]; planCounts: Record<string, number> }>(
        "/api/billing/overview"
      );
      setCompanies(data.companies);
      setPlanCounts(data.planCounts);
    } catch (err: any) {
      setError(err.message || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changePlan(id: string, plan: string) {
    setUpdatingId(id);
    try {
      await apiRequest(`/api/billing/companies/${id}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ subscriptionPlan: plan }),
      });
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to update plan");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blue-950">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Subscription plans across all companies</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {PLAN_OPTIONS.map((plan) => (
          <StatCard
            key={plan}
            label={plan.charAt(0).toUpperCase() + plan.slice(1)}
            value={planCounts[plan] || 0}
            accent={plan === "trial" ? "orange" : "green"}
          />
        ))}
      </div>

      <div className="bg-white rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Company</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Plan</th>
              <th className="text-left px-5 py-3 font-medium">Change plan</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c._id} className="border-t border-gray-100">
                <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-5 py-3 text-gray-600">{c.status}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${planStyles[c.subscriptionPlan]}`}>
                    {c.subscriptionPlan}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={c.subscriptionPlan}
                    disabled={updatingId === c._id}
                    onChange={(e) => changePlan(c._id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-green-600"
                  >
                    {PLAN_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}