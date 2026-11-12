"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import FullPageLoading from "@/app/components/FullPageLoading";
import { usePageHeader } from "@/app/components/DashboardShell";
import IndustryBanner from "@/app/components/IndustryBanner";
import { CompanyRecord, AdminRecord, CompanyStats, PlatformDecisions } from "../../../types/auth";
import { industryLabel } from "../../../lib/industries";
import { vehicleTypeLabel } from "../../../lib/vehicleTypes";
import { formatKes } from "../../../lib/pricing";
import OpenFleetButton from "@/app/components/staff/OpenFleetButton";

// GET /api/support/audit: what Figbloom staff did to this fleet.
interface StaffAuditRow {
  _id: string;
  staffEmail: string;
  action: "support_view_started" | "support_view_ended" | "fleet_created" | string;
  createdAt: string;
}
const AUDIT_LABELS: Record<string, string> = {
  support_view_started: "opened this fleet (read-only)",
  support_view_ended: "left the fleet",
  fleet_created: "created this fleet",
};

const statusStyles: Record<string, string> = {
  active: "bg-teal-50 text-teal-600 border-teal-200",
  pending: "bg-orange-50 text-orange-600 border-orange-200",
  suspended: "bg-gray-100 text-gray-500 border-gray-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [users, setUsers] = useState<AdminRecord[]>([]);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  // While on, approval and suspension are decided in the Figbloom console.
  const [platformDecisions, setPlatformDecisions] = useState<PlatformDecisions | null>(null);
  const [audit, setAudit] = useState<StaffAuditRow[] | null>(null);

  async function load() {
    try {
      const data = await apiRequest<{ company: CompanyRecord; users: AdminRecord[]; platformDecisions?: PlatformDecisions }>(
        `/api/companies/${id}`
      );
      setCompany(data.company);
      setUsers(data.users);
      setPlatformDecisions(data.platformDecisions ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to load company");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    apiRequest<CompanyStats>(`/api/companies/${id}/stats`)
      .then(setStats)
      .catch(() => {});
    apiRequest<StaffAuditRow[]>(`/api/support/audit?companyId=${encodeURIComponent(id)}`)
      .then(setAudit)
      .catch(() => {});
  }, [id]);

  async function updateStatus(status: string) {
    setUpdating(true);
    try {
      await apiRequest(`/api/companies/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  usePageHeader(company?.name ?? "Company", company ? `/${company.slug}` : undefined);

  if (loading) return <FullPageLoading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!company) return null;

  return (
    <div>
      <button
        onClick={() => router.push("/platform/companies")}
        className="mb-4 rounded bg-gray-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600"
      >
        Back to customer fleets
      </button>

      <div className="mb-6 flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-gray-600">
          See this fleet&apos;s dashboard, vehicles, live map, trips and drivers the way its owner does. Read-only: nothing
          can be changed, and your visit is recorded below.
        </p>
        <OpenFleetButton companyId={company._id} />
      </div>

      <div className="mb-6 flex justify-end">
        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${statusStyles[company.status]}`}>
          {company.status}
        </span>
      </div>

      <IndustryBanner industry={company.industry} />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Details + users */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5">
            <h3 className="text-sm font-medium text-gray-700">Company details</h3>
            <p className="text-xs text-teal-600 mt-0.5 mb-3">Plan, sign-up date, and user count</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Subscription plan</dt>
                <dd className="text-gray-900 font-medium mt-0.5">{company.subscriptionPlan}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Industry</dt>
                <dd className="text-gray-900 font-medium mt-0.5">{industryLabel(company.industry)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Registered</dt>
                <dd className="text-gray-900 font-medium mt-0.5">
                  {new Date(company.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Total users</dt>
                <dd className="text-gray-900 font-medium mt-0.5">{users.length}</dd>
              </div>
            </dl>
          </div>

          {stats && (
            <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5">
              <h3 className="text-sm font-medium text-gray-700">Fleet</h3>
              <p className="text-xs text-teal-600 mt-0.5 mb-3">Vehicles, distance, and money on this company's account</p>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                <div>
                  <dt className="text-gray-500">Vehicles</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">{stats.vehicleCount}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Distance covered</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">{stats.totalDistanceKm} km</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Estimated subscription cost</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">
                    {stats.estimatedExpenses === null ? "Custom plan" : formatKes(stats.estimatedExpenses)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Revenue</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">{formatKes(stats.totalRevenue)}</dd>
                </div>
              </dl>

              {stats.vehicleTypeBreakdown && Object.keys(stats.vehicleTypeBreakdown).length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Vehicle types</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.vehicleTypeBreakdown).map(([type, count]) => (
                      <span
                        key={type}
                        className="text-xs px-2.5 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-200"
                      >
                        {vehicleTypeLabel(type)} · {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {audit && (
            <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5">
              <h3 className="text-sm font-medium text-gray-700">Figbloom staff activity</h3>
              <p className="text-xs text-teal-600 mt-0.5 mb-3">Every time staff opened or created this fleet</p>
              {audit.length === 0 ? (
                <p className="text-xs text-gray-400">No staff visits yet.</p>
              ) : (
                <ul className="space-y-1.5 text-xs text-gray-600">
                  {audit.map((row) => (
                    <li key={row._id} className="flex flex-wrap gap-x-2">
                      <span className="text-gray-400">{new Date(row.createdAt).toLocaleString()}</span>
                      <span>
                        <span className="font-medium text-gray-800">{row.staffEmail}</span> {AUDIT_LABELS[row.action] ?? row.action}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
            <h3 className="text-sm font-medium text-gray-700 px-5 pt-5">Users</h3>
            <p className="text-xs text-teal-600 px-5">Admins and drivers on this company's account</p>
            <table className="w-full text-sm mt-3">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id} className="border-t border-gray-100">
                      <td className="px-5 py-3 font-medium text-gray-900">{u.fullName}</td>
                      <td className="px-5 py-3 text-gray-600">{u.email}</td>
                      <td className="px-5 py-3 text-gray-600">{u.role}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status controls */}
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5 h-fit">
          <h3 className="text-sm font-medium text-gray-700">Manage status</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-4">Controls whether this company can access the platform</p>
          {platformDecisions?.enabled ? (
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p>
                Approving, rejecting, suspending and reactivating companies is decided in the Figbloom console. Its
                decisions reach this page by themselves.
              </p>
              <a
                href={platformDecisions.consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded bg-blue-950 px-3 py-1.5 text-sm font-medium text-white"
              >
                Open the Figbloom console
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => updateStatus("active")}
                disabled={updating || company.status === "active"}
                className="w-full py-2 rounded text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-40"
              >
                Approve / Activate
              </button>
              <button
                onClick={() => updateStatus("suspended")}
                disabled={updating || company.status === "suspended"}
                className="w-full py-2 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40"
              >
                Suspend
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}