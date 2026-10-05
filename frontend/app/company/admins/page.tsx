"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { AdminRecord } from "../../types/auth";
import Skeleton from "../../components/Skeleton";
import PasswordInput from "../../components/PasswordInput";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAdmins() {
    try {
      const data = await apiRequest<AdminRecord[]>("/api/users/admins");
      setAdmins(data);
    } catch (err: any) {
      setError(err.message || "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await apiRequest("/api/auth/users", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName, role: "ADMIN" }),
      });
      setFullName("");
      setEmail("");
      setPassword("");
      await loadAdmins();
    } catch (err: any) {
      setFormError(err.message || "Failed to add admin");
    } finally {
      setIsSubmitting(false);
    }
  }

  usePageHeader("Admins", "People who manage your fleet's day-to-day tracking");

  return (
    <div>
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Admins list */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
          {error && <p className="text-sm text-red-600 p-5">{error}</p>}
          {!loading && !error && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                      No admins added yet.
                    </td>
                  </tr>
                ) : (
                  admins.map((a) => (
                    <tr key={a._id} className="border-t border-gray-100">
                      <td className="px-5 py-3 font-medium text-gray-900">{a.fullName}</td>
                      <td className="px-5 py-3 text-gray-600">{a.email}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-1 rounded-full border bg-teal-50 text-teal-600 border-teal-200">
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Add admin form */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 h-fit">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Add an admin</h3>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>

            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmitting ? "Adding…" : "Add admin"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}