"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { DistanceIcon, ExpensesIcon } from "../../components/StatCard";
import { apiRequest } from "../../lib/api";
import FullPageLoading from "@/app/components/FullPageLoading";
import { CompanyRecord, CompanyStats, TransactionRecord } from "../../types/auth";
import { industryLabel } from "../../lib/industries";
import { usePageHeader } from "../../components/DashboardShell";
import PlanCheckoutModal, { SelfServePlan } from "../../components/PlanCheckoutModal";
import { PLAN_PRICING_KES, SPECIAL_OFFER, priceForPlan, formatKes, offerLabel } from "../../lib/pricing";

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
  originalPrice?: string;
  cadence: string;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    id: "basic",
    label: "Basic",
    price: formatKes(PLAN_PRICING_KES.basic),
    cadence: "per vehicle / month",
    features: ["Up to 15 vehicles", "Live GPS tracking", "Trip history & reports", "Speeding & idle alerts"],
  },
  {
    id: "pro",
    label: "Pro",
    price: formatKes(priceForPlan("pro")),
    originalPrice:
      SPECIAL_OFFER.active && SPECIAL_OFFER.plan === "pro" ? formatKes(PLAN_PRICING_KES.pro) : undefined,
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
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

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

  function loadTransactions() {
    apiRequest<TransactionRecord[]>("/api/billing/transactions/mine")
      .then(setTransactions)
      .catch(() => {});
  }

  useEffect(loadTransactions, []);

  usePageHeader("Billing", "Your subscription details");

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!company) return null;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-6 space-y-5 max-w-xl">
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
        <h2 className="text-base font-semibold text-gray-900 mb-1">Expenses</h2>
        <p className="text-xs text-teal-600 mb-4">Distance and expenses are calculated automatically.</p>

        <div className="grid sm:grid-cols-2 gap-5 max-w-md">
          <div className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="shrink-0 rounded-md bg-blue-50 p-2.5 text-blue-600">
              <DistanceIcon size={18} />
            </span>
            <div>
              <p className="text-xs text-gray-500">Total distance covered</p>
              <p className="text-lg font-bold text-gray-900">{stats?.totalDistanceKm ?? 0} km</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="shrink-0 rounded-md bg-orange-50 p-2.5 text-orange-600">
              <ExpensesIcon size={18} />
            </span>
            <div>
              <p className="text-xs text-gray-500">Estimated subscription cost</p>
              <p className="text-lg font-bold text-gray-900">
                {stats?.estimatedExpenses === null ? "Custom plan" : formatKes(stats?.estimatedExpenses ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {SPECIAL_OFFER.active && (
        <div className="relative overflow-hidden rounded-lg bg-teal-950 shadow-sm">
          <div className="relative flex items-center gap-3 px-5 py-4">
            <span className="animate-shake inline-block shrink-0 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Special offer
            </span>
            <span className="text-sm font-medium text-white">{offerLabel()}</span>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Change plan</h2>
        <p className="text-xs text-teal-600 mb-4">Upgrade or switch plans — pay with M-Pesa or Paystack.</p>

        <div className="flex items-center gap-4 mb-6 rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5 max-w-md">
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
                className={`relative flex flex-col rounded-lg bg-white p-5 shadow-sm ring-1 ${
                  p.highlighted ? "ring-2 ring-orange-500" : "ring-black/5"
                }`}
              >
                {p.highlighted && (
                  <span className="absolute -top-3 left-5 bg-orange-500 text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
                    {p.originalPrice ? `Save ${SPECIAL_OFFER.discountPercent}%` : "Most popular"}
                  </span>
                )}
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">{p.label}</h3>
                {p.originalPrice && (
                  <p className="text-sm text-gray-400 line-through">{p.originalPrice}</p>
                )}
                <p className="text-2xl font-bold text-gray-900 mb-0.5">{p.price}</p>
                <p className="text-xs text-gray-400 mb-4">{p.cadence}</p>

                <ul className="text-xs text-gray-600 space-y-1.5 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>

                {isCurrent ? (
                  <span className="text-center px-4 py-2 rounded text-xs font-medium text-gray-400 border border-gray-200">
                    Current plan
                  </span>
                ) : p.id === "enterprise" ? (
                  <a
                    href="mailto:sales@figbloomfleet.com"
                    className="text-center px-4 py-2 rounded text-xs font-medium text-gray-700 border border-gray-300 hover:border-gray-400"
                  >
                    Contact sales
                  </a>
                ) : (
                  <button
                    onClick={() => setCheckoutPlan(p.id as SelfServePlan)}
                    className={`text-center px-4 py-2 rounded text-xs font-medium transition-colors ${
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

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Payment history</h2>
        <p className="text-xs text-teal-600 mb-4">Every real charge made on this account, most recent first.</p>

        <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No payments yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Plan</th>
                  <th className="text-left px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Channel</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t._id} className="border-t border-gray-100">
                    <td className="px-5 py-3 text-gray-600">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-900 font-medium capitalize">{t.plan}</td>
                    <td className="px-5 py-3 text-gray-600">{formatKes(t.amount)}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {t.channel === "mobile_money" ? "M-Pesa" : t.channel === "card" ? "Card" : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${
                          t.status === "success"
                            ? "bg-teal-50 text-teal-600 border-teal-200"
                            : t.status === "pending"
                              ? "bg-orange-50 text-orange-600 border-orange-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {checkoutPlan && (
        <PlanCheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={(updated) => {
            setCompany(updated);
            loadTransactions();
          }}
        />
      )}
    </div>
  );
}
