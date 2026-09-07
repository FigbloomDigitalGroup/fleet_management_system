"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { CompanyRecord } from "../../types/auth";

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiRequest<CompanyRecord>("/api/companies/me")
      .then((data) => {
        setCompany(data);
        setName(data.name);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const updated = await apiRequest<CompanyRecord>("/api/companies/me", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setCompany(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!company) return null;

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your company profile</p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Company URL slug</label>
          <input
            type="text"
            disabled
            value={company.slug}
            className="w-full px-3 py-2 rounded-md text-sm border border-gray-200 bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">Generated automatically — cannot be changed</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Changes saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}



