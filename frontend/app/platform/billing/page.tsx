"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import StatCard from "../../components/StatCard";
import FullPageLoading from "@/app/components/FullPageLoading";
import { usePageHeader } from "../../components/DashboardShell";

interface BillingCompany {
  _id: string;
  name: string;
  status: string;
  subscriptionPlan: string;
  paymentMethod?: "mpesa" | "paystack" | null;
  createdAt: string;
}

const paymentMethodLabels: Record<string, string> = {
  mpesa: "M-Pesa",
  paystack: "Paystack",
};

const planStyles: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600 border-gray-200",
  basic: "bg-blue-50 text-blue-600 border-blue-200",
  pro: "bg-teal-50 text-teal-600 border-teal-200",
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

  const statsNode = useMemo(
    () => (
      <div className="grid grid-cols-2 gap-3 h-full">
        {PLAN_OPTIONS.map((plan) => (
          <StatCard
            key={plan}
            label={plan.charAt(0).toUpperCase() + plan.slice(1)}
            value={planCounts[plan] || 0}
            accent={plan === "trial" ? "orange" : "green"}
          />
        ))}
      </div>
    ),
    [planCounts]
  );

  usePageHeader("Billing", "Subscription plans across all companies", statsNode);

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Company</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Plan</th>
              <th className="text-left px-5 py-3 font-medium">Payment method</th>
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
                <td className="px-5 py-3 text-gray-600">
                  {c.paymentMethod ? paymentMethodLabels[c.paymentMethod] : "—"}
                </td>
                <td className="px-5 py-3">
                  <select
                    value={c.subscriptionPlan}
                    disabled={updatingId === c._id}
                    onChange={(e) => changePlan(c._id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-teal-600"
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