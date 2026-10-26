"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import FullPageLoading from "@/app/components/FullPageLoading";
import { CompanyRecord } from "../../types/auth";
import { usePageHeader } from "../../components/DashboardShell";
import CompanyOpsSettings from "../../components/CompanyOpsSettings";
import Avatar from "../../components/Avatar";
import ImageUploadButton from "../../components/ImageUploadButton";

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

  usePageHeader("Settings", "Company profile, alerts, tracking hours and data retention");

  if (loading) return <FullPageLoading />;
  if (!company) return null;

  return (
    <div className="max-w-4xl space-y-4">
      <form onSubmit={handleSave} className="max-w-xl bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Company logo</label>
          <div className="flex items-center gap-4">
            <Avatar src={company.logoUrl} name={company.name} size="lg" shape="square" />
            <div>
              <ImageUploadButton
                endpoint="/api/companies/me/logo"
                kind="logo"
                label={company.logoUrl ? "Change logo" : "Upload logo"}
                hasImage={!!company.logoUrl}
                onChange={(logoUrl) => setCompany({ ...company, logoUrl })}
              />
              <p className="mt-1 text-xs text-gray-400">Shown on your dashboard, the driver app and to the platform team.</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Company URL slug</label>
          <input
            type="text"
            disabled
            value={company.slug}
            className="w-full px-3 py-2 rounded text-sm border border-gray-200 bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-teal-600 mt-1">Generated automatically — cannot be changed</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-teal-600">Changes saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <CompanyOpsSettings />
    </div>
  );
}



