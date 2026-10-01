"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FaMoneyBillWave } from "react-icons/fa";
import { DistanceIcon, ExpensesIcon } from "../../components/StatCard";
import { apiRequest } from "../../lib/api";
import FullPageLoading from "@/app/components/FullPageLoading";
import { CompanyRecord, CompanyStats } from "../../types/auth";
import { industryLabel } from "../../lib/industries";
import { usePageHeader } from "../../components/DashboardShell";
import PlanCheckoutModal, { SelfServePlan } from "../../components/PlanCheckoutModal";

const ACCEPTED_PAYMENT_METHODS = [
  { id: "mpesa", label: "M-Pesa", logo: "/mpesa-logo.png" },
  { id: "paystack", label: "Paystack", logo: "/paystack-logo.png" },
];

const planStyles: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600 border-gray-200",
  basic: "bg-blue-50 text-blue-600 border-blue-200",
  pro: "bg-teal-50 text-teal-600 border-teal-200",
  enterprise: "bg-orange-50 text-orange-600 border-orange-200",
};

const paymentMethodLabels: Record<string, string> = {
  mpesa: "M-Pesa",
  paystack: "Paystack",
};

const PLAN_CARDS: {
  id: SelfServePlan | "enterprise";
  label: string;
  price: string;
  cadence: string;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    id: "basic",
    label: "Basic",
    price: "$29",
    cadence: "per vehicle / month",
    features: ["Up to 15 vehicles", "Live GPS tracking", "Trip history & reports", "Speeding & idle alerts"],
  },
  {
    id: "pro",
    label: "Pro",
    price: "$49",
    cadence: "per vehicle / month",
    features: ["Up to 50 vehicles", "Everything in Basic", "Driver behavior alerts", "AI fleet assistant chat"],
    highlighted: true,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: "Custom",
    cadence: "contact us",
    features: ["Unlimited vehicles", "Everything in Pro", "Dedicated account manager", "SLA-backed support"],
  },
];

export default function CompanyBillingPage() {
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<SelfServePlan | null>(null);
  const [revenueInput, setRevenueInput] = useState("");
  const [editingRevenue, setEditingRevenue] = useState(false);
  const [savingRevenue, setSavingRevenue] = useState(false);

  useEffect(() => {
    apiRequest<CompanyRecord>("/api/companies/me")
      .then(setCompany)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiRequest<CompanyStats>("/api/companies/me/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  async function saveRevenue() {
    const value = Number(revenueInput);
    if (Number.isNaN(value) || value < 0) return;

    setSavingRevenue(true);
    try {
      const updated = await apiRequest<CompanyRecord>("/api/companies/me/revenue", {
        method: "PATCH",
        body: JSON.stringify({ totalRevenue: value }),
      });
      setCompany(updated);
      setStats((s) => (s ? { ...s, totalRevenue: value } : s));
      setEditingRevenue(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRevenue(false);
    }
  }

  usePageHeader("Billing", "Your subscription details");

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!company) return null;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-6 space-y-5 max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current plan</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5 capitalize">{company.subscriptionPlan}</p>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${planStyles[company.subscriptionPlan]}`}>
            {company.subscriptionPlan}
          </span>
        </div>

        <hr className="border-gray-100" />

        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-sm text-gray-500">Account status</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5 capitalize">{company.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Payment method</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {company.paymentMethod ? paymentMethodLabels[company.paymentMethod] : "None on file"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Industry</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{industryLabel(company.industry)}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500">Member since</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">
            {new Date(company.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Expenses &amp; revenue</h2>
        <p className="text-xs text-teal-600 mb-4">
          Distance and expenses are calculated automatically. Revenue is entered by you.
        </p>

        <div className="grid sm:grid-cols-3 gap-5">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="shrink-0 rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <DistanceIcon size={18} />
            </span>
            <div>
              <p className="text-xs text-gray-500">Total distance covered</p>
              <p className="text-lg font-bold text-gray-900">{stats?.totalDistanceKm ?? 0} km</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="shrink-0 rounded-xl bg-orange-50 p-2.5 text-orange-600">
              <ExpensesIcon size={18} />
            </span>
            <div>
              <p className="text-xs text-gray-500">Estimated expenses</p>
              <p className="text-lg font-bold text-gray-900">
                {stats?.estimatedExpenses === null ? "Custom plan" : `$${stats?.estimatedExpenses ?? 0}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="shrink-0 rounded-xl bg-teal-50 p-2.5 text-teal-600">
              <FaMoneyBillWave size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Revenue</p>
              {editingRevenue ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    value={revenueInput}
                    onChange={(e) => setRevenueInput(e.target.value)}
                    className="w-24 px-2 py-1 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600"
                  />
                  <button
                    onClick={saveRevenue}
                    disabled={savingRevenue}
                    className="text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md px-2 py-1 disabled:opacity-50"
                  >
                    {savingRevenue ? "..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingRevenue(false)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 px-1"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setRevenueInput(String(stats?.totalRevenue ?? company.totalRevenue ?? 0));
                    setEditingRevenue(true);
                  }}
                  className="text-left"
                >
                  <p className="text-lg font-bold text-gray-900 hover:underline">
                    ${stats?.totalRevenue ?? company.totalRevenue ?? 0}
                  </p>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Change plan</h2>
        <p className="text-xs text-teal-600 mb-4">Upgrade or switch plans — pay with M-Pesa or Paystack.</p>

        <div className="flex items-center gap-4 mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 max-w-md">
          <div className="flex items-center -space-x-2">
            {ACCEPTED_PAYMENT_METHODS.map((m) => (
              <div
                key={m.id}
                className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-white shadow-sm"
              >
                <Image src={m.logo} alt={m.label} width={40} height={40} unoptimized className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900">Accepted payment methods</p>
            <p className="text-xs text-gray-500">M-Pesa and Paystack — choose either when you upgrade below.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {PLAN_CARDS.map((p) => {
            const isCurrent = company.subscriptionPlan === p.id;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ${
                  p.highlighted ? "ring-2 ring-orange-500" : "ring-black/5"
                }`}
              >
                {p.highlighted && (
                  <span className="absolute -top-3 left-5 bg-orange-500 text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
                    Most popular
                  </span>
                )}
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">{p.label}</h3>
                <p className="text-2xl font-bold text-gray-900 mb-0.5">{p.price}</p>
                <p className="text-xs text-gray-400 mb-4">{p.cadence}</p>

                <ul className="text-xs text-gray-600 space-y-1.5 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>

                {isCurrent ? (
                  <span className="text-center px-4 py-2 rounded-md text-xs font-medium text-gray-400 border border-gray-200">
                    Current plan
                  </span>
                ) : p.id === "enterprise" ? (
                  <a
                    href="mailto:sales@figbloomfleet.com"
                    className="text-center px-4 py-2 rounded-md text-xs font-medium text-gray-700 border border-gray-300 hover:border-gray-400"
                  >
                    Contact sales
                  </a>
                ) : (
                  <button
                    onClick={() => setCheckoutPlan(p.id as SelfServePlan)}
                    className={`text-center px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                      p.highlighted
                        ? "text-white bg-orange-500 hover:bg-orange-600"
                        : "text-white bg-teal-600 hover:bg-teal-700"
                    }`}
                  >
                    Choose {p.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {checkoutPlan && (
        <PlanCheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={(updated) => setCompany(updated)}
        />
      )}
    </div>
  );
}
