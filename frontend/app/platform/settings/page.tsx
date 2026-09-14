"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import Toggle from "../../components/Toggle";
import FullPageLoading from "@/app/components/FullPageLoading";

interface Settings {
  requireManualApproval: boolean;
  defaultPlan: string;
  trialDays: number;
  vehicleLimits: { trial: number; basic: number; pro: number; enterprise: number };
  supportEmail: string;
}

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiRequest<Settings>("/api/settings")
      .then(setSettings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const updated = await apiRequest<Settings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageLoading />;
  if (!settings) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blue-950">Platform Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Policies applied to every company on the platform</p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <Toggle
          checked={settings.requireManualApproval}
          onChange={(value) => setSettings({ ...settings, requireManualApproval: value })}
          label="Require manual approval"
          description='New companies stay "pending" until you approve them'
        />

        <hr className="border-gray-100" />

        {/* Default plan */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Default plan for new sign-ups</label>
          <select
            value={settings.defaultPlan}
            onChange={(e) => setSettings({ ...settings, defaultPlan: e.target.value })}
            className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          >
            <option value="trial">Trial</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Trial days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Trial length (days)</label>
          <input
            type="number"
            min={1}
            value={settings.trialDays}
            onChange={(e) => setSettings({ ...settings, trialDays: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          />
        </div>

        <hr className="border-gray-100" />

        {/* Vehicle limits per plan */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Vehicle limits per plan</p>
          <div className="grid grid-cols-2 gap-3">
            {(["trial", "basic", "pro", "enterprise"] as const).map((plan) => (
              <div key={plan}>
                <label className="block text-xs text-gray-500 mb-1 capitalize">{plan}</label>
                <input
                  type="number"
                  min={1}
                  value={settings.vehicleLimits[plan]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      vehicleLimits: { ...settings.vehicleLimits, [plan]: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                />
              </div>
            ))}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Support email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Support contact email</label>
          <input
            type="email"
            value={settings.supportEmail}
            onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
            className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Settings saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}