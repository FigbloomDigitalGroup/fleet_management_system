"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import { CompanyRecord } from "../../types/auth";

const statusStyles: Record<string, string> = {
  active: "bg-green-50 text-green-600 border-green-200",
  pending: "bg-orange-50 text-orange-600 border-orange-200",
  suspended: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest<CompanyRecord[]>("/api/companies");
        setCompanies(data);
      } catch (err: any) {
        setError(err.message || "Failed to load companies");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blue-950">Companies</h1>
        <p className="text-sm text-gray-500 mt-1">Every vehicle company registered on the platform</p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {error && (
        <div className="text-sm px-3.5 py-2.5 rounded-md bg-red-50 text-red-600 border border-red-200 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Company</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Plan</th>
                <th className="text-left px-5 py-3 font-medium">Users</th>
                <th className="text-left px-5 py-3 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    No companies registered yet.
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c._id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <Link
                        href={`/platform/companies/${c._id}`}
                        className="inline-block cursor-pointer rounded-md bg-blue-950 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusStyles[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.subscriptionPlan}</td>
                    <td className="px-5 py-3 text-gray-600">{c.userCount ?? "-"}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}