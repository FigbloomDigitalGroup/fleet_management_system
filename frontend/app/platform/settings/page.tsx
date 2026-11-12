"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import Toggle from "../../components/Toggle";
import FullPageLoading from "@/app/components/FullPageLoading";
import { usePageHeader } from "../../components/DashboardShell";

interface Settings {
  requireManualApproval: boolean;
  defaultPlan: string;
  trialDays: number;
  vehicleLimits: { trial: number; basic: number; pro: number; enterprise: number };
  supportEmail: string;
  // Read-only: Figbloom-console decisions are switched on for this server
  // (PLATFORM_DECISIONS_ENABLED), so the console decides, not the toggle.
  consoleDecisions?: boolean;
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
      setSettings({ ...updated, consoleDecisions: settings.consoleDecisions });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  usePageHeader("Settings", "Policies applied to every company on the platform");

  if (loading) return <FullPageLoading />;
  if (!settings) return null;

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSave} className="bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-6 space-y-6">
        <div>
          <Toggle
            checked={settings.requireManualApproval}
            onChange={(value) => setSettings({ ...settings, requireManualApproval: value })}
            label="Require manual approval"
            description={
              settings.requireManualApproval
                ? 'On (the default): every new fleet stays "pending" until Figbloom staff approve it under Customer fleets. Owners who sign in meanwhile see a "waiting for approval" page, and the sign-up screen tells them a person reviews new fleets within about one working day.'
                : "Off: new fleets are switched on as soon as they register, and the owner can sign in straight away."
            }
          />
          {settings.consoleDecisions ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">Not in effect on this server:</span> Figbloom-console decisions are switched on, so
              every new fleet waits for the{" "}
              <a href="https://console.figbloom.org" target="_blank" rel="noopener noreferrer" className="font-medium underline">
                Figbloom console
              </a>
              . The console&apos;s per-product auto-approve setting decides whether it&apos;s switched on automatically (usually
              within a minute) or waits for a person there. This toggle is ignored until console decisions are turned off.
            </p>
          ) : (
            <p className="mt-3 text-xs text-gray-500">
              Figbloom-console decisions are off on this server, so this toggle decides.
            </p>
          )}
        </div>

        <hr className="border-gray-100" />

        {/* Default plan */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Default plan for new sign-ups</label>
          <select
            value={settings.defaultPlan}
            onChange={(e) => setSettings({ ...settings, defaultPlan: e.target.value })}
            className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
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
            className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
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
                  className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
            ))}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Support email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Support contact email</label>
          <p className="-mt-1 mb-1.5 text-xs text-gray-500">
            Shown to customers on the sign-in status pages (waiting for approval, paused, trial ended).
          </p>
          <input
            type="email"
            value={settings.supportEmail}
            onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
            className="w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-teal-600">Settings saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}