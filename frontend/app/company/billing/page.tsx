"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import FullPageLoading from "@/app/components/FullPageLoading";
import { CompanyRecord } from "../../types/auth";

const planStyles: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600 border-gray-200",
  basic: "bg-blue-50 text-blue-600 border-blue-200",
  pro: "bg-green-50 text-green-600 border-green-200",
  enterprise: "bg-orange-50 text-orange-600 border-orange-200",
};

export default function CompanyBillingPage() {
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<CompanyRecord>("/api/companies/me")
      .then(setCompany)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!company) return null;

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-blue-950">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Your subscription details</p>
      </div>

      <div className="bg-white rounded-lg p-6 space-y-5">
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

        <div>
          <p className="text-sm text-gray-500">Account status</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5 capitalize">{company.status}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Member since</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">
            {new Date(company.createdAt).toLocaleDateString()}
          </p>
        </div>

        <hr className="border-gray-100" />

        <p className="text-xs text-gray-400">
          To change your plan or billing details, contact support@getour.com.
        </p>
      </div>
    </div>
  );
}