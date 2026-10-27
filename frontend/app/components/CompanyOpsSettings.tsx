"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { apiRequest, errorMessage } from "../lib/api";
import { AlertSettings, CompanySettings, TrackingHours } from "../types/auth";
import Skeleton from "./Skeleton";
import Toggle from "./Toggle";
import Switch from "./Switch";

const inputClass =
  "w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:bg-gray-50 disabled:text-gray-500";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const THRESHOLDS: { key: keyof AlertSettings; label: string; unit: string; min: number; max: number; help: string }[] = [
  { key: "speedLimitKph", label: "Speed limit", unit: "km/h", min: 20, max: 200, help: "Above this counts as speeding" },
  { key: "idleMinutes", label: "Idle alert after", unit: "min", min: 1, max: 240, help: "Engine on, not moving" },
  { key: "offlineMinutes", label: "Offline alert after", unit: "min", min: 5, max: 1440, help: "No signal from the phone during tracking hours" },
  { key: "lowBatteryPercent", label: "Low battery at", unit: "%", min: 5, max: 50, help: "Driver phone battery level" },
  { key: "harshBrakingKphPerSec", label: "Harsh braking", unit: "km/h per s", min: 3, max: 30, help: "Speed lost per second" },
  { key: "harshAccelerationKphPerSec", label: "Harsh acceleration", unit: "km/h per s", min: 3, max: 30, help: "Speed gained per second" },
];

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      <p className="mb-4 mt-0.5 text-xs text-teal-600">{subtitle}</p>
      {children}
    </div>
  );
}

function SaveRow({ saving, saved, error, disabled }: { saving: boolean; saved: boolean; error: string | null; disabled: boolean }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={saving || disabled}
        className="rounded bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {saved && <span className="text-sm text-teal-600">Saved.</span>}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

// Each card saves on its own (partial PUT) so a validation error in one
// doesn't block or discard changes in another.
function useSection() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: object, onDone: (s: Partial<CompanySettings>) => void) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await apiRequest<Partial<CompanySettings>>("/api/companies/me/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      onDone(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(errorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }
  return { saving, saved, error, run };
}

// Alert thresholds, tracking hours and data retention — company-wide
// operational settings, shown to the owner and to full admins.
export default function CompanyOpsSettings({ canEdit = true }: { canEdit?: boolean }) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertSettings | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<TrackingHours | null>(null);
  const [retention, setRetention] = useState("");

  const alertSection = useSection();
  const hoursSection = useSection();
  const retentionSection = useSection();

  function apply(s: Partial<CompanySettings>) {
    if (s.alertSettings) {
      setAlert(s.alertSettings);
      setNumbers(Object.fromEntries(THRESHOLDS.map((t) => [t.key, String(s.alertSettings![t.key] ?? "")])));
    }
    if (s.trackingHours) setHours(s.trackingHours);
    if (s.dataRetentionDays != null) setRetention(String(s.dataRetentionDays));
    setSettings((prev) => (prev ? { ...prev, ...s } : (s as CompanySettings)));
  }

  useEffect(() => {
    apiRequest<CompanySettings>("/api/companies/me/settings")
      .then(apply)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load settings")));
  }, []);

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!settings || !alert || !hours) return <Skeleton rows={4} rowClassName="h-24" />;

  function toggleIn(list: string[], key: string, on: boolean) {
    return on ? [...new Set([...list, key])] : list.filter((k) => k !== key);
  }

  function saveAlerts(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      disabledTypes: alert!.disabledTypes,
      emailTypes: alert!.emailTypes,
      emailRecipientIds: alert!.emailRecipientIds,
    };
    for (const t of THRESHOLDS) body[t.key] = Number(numbers[t.key]);
    alertSection.run({ alertSettings: body }, apply);
  }

  function saveHours(e: FormEvent) {
    e.preventDefault();
    hoursSection.run({ trackingHours: hours }, apply);
  }

  function saveRetention(e: FormEvent) {
    e.preventDefault();
    retentionSection.run({ dataRetentionDays: Number(retention) }, apply);
  }

  const recipientIds = alert.emailRecipientIds.map(String);

  return (
    <div className="space-y-4">
      <Card title="Alerts" subtitle="When alerts are raised, and which ones are also emailed">
        <form onSubmit={saveAlerts}>
          <fieldset disabled={!canEdit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {THRESHOLDS.map((t) => (
                <div key={t.key}>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {t.label} <span className="font-normal text-gray-400">({t.unit})</span>
                  </label>
                  <input
                    type="number"
                    min={t.min}
                    max={t.max}
                    step="any"
                    required
                    value={numbers[t.key] ?? ""}
                    onChange={(e) => setNumbers((n) => ({ ...n, [t.key]: e.target.value }))}
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    {t.help} · {t.min}–{t.max}
                  </p>
                </div>
              ))}
            </div>

            <h4 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-gray-500">Alert types</h4>
            <div className="overflow-x-auto rounded border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Alert</th>
                    <th className="px-4 py-2 text-center font-medium">Raise this alert</th>
                    <th className="px-4 py-2 text-center font-medium">Email it</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.alertTypes.map((t) => {
                    const enabled = !alert.disabledTypes.includes(t.key);
                    const emailed = alert.emailTypes.includes(t.key);
                    return (
                      <tr key={t.key} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-700">{t.label}</td>
                        <td className="px-4 py-2 text-center">
                          <Switch
                            size="sm"
                            label={`Raise ${t.label} alerts`}
                            checked={enabled}
                            onChange={(on) => setAlert({ ...alert, disabledTypes: toggleIn(alert.disabledTypes, t.key, !on) })}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Switch
                            size="sm"
                            label={`Email ${t.label} alerts`}
                            checked={emailed}
                            disabled={!enabled}
                            onChange={(on) => setAlert({ ...alert, emailTypes: toggleIn(alert.emailTypes, t.key, on) })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h4 className="mb-1 mt-6 text-xs font-bold uppercase tracking-wide text-gray-500">Email recipients</h4>
            <p className="mb-2 text-[11px] text-gray-400">Who gets the alert types switched on under “Email it”.</p>
            {settings.possibleRecipients.length === 0 ? (
              <p className="text-sm text-gray-400">No owners or admins to email yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {settings.possibleRecipients.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
                    <Switch
                      size="sm"
                      checked={recipientIds.includes(String(r.id))}
                      onChange={(on) => setAlert({ ...alert, emailRecipientIds: toggleIn(recipientIds, String(r.id), on) })}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">{r.fullName}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {r.email} · {r.role === "COMPANY_OWNER" ? "Owner" : "Admin"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          {canEdit && <SaveRow {...alertSection} disabled={false} />}
        </form>
      </Card>

      <Card title="Tracking hours" subtitle="Limit location sharing to working hours">
        <form onSubmit={saveHours}>
          <fieldset disabled={!canEdit} className="space-y-4">
            <div className="max-w-md">
              <Toggle
                checked={hours.enabled}
                onChange={(v) => canEdit && setHours({ ...hours, enabled: v })}
                label="Only track during these hours"
                description="Off means drivers share location whenever the app is running"
              />
            </div>
            <div className={`space-y-4 ${hours.enabled ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Start</label>
                  <input
                    type="time"
                    required
                    value={hours.start}
                    onChange={(e) => setHours({ ...hours, start: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">End</label>
                  <input
                    type="time"
                    required
                    value={hours.end}
                    onChange={(e) => setHours({ ...hours, end: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((label, day) => {
                  const on = hours.days.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setHours({
                          ...hours,
                          days: on ? hours.days.filter((d) => d !== day) : [...hours.days, day].sort((a, b) => a - b),
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        on ? "border-teal-600 bg-teal-600 text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              Times are Nairobi time (EAT). Drivers see these hours in the app, and their phones only share location inside
              them — outside the window there&apos;s no tracking and no offline alerts.
            </p>
          </fieldset>
          {canEdit && <SaveRow {...hoursSection} disabled={hours.days.length === 0} />}
          {canEdit && hours.days.length === 0 && <p className="mt-2 text-xs text-orange-600">Pick at least one day.</p>}
        </form>
      </Card>

      <Card title="Data retention" subtitle="How long detailed location history is kept">
        <form onSubmit={saveRetention}>
          <fieldset disabled={!canEdit}>
            <label className="mb-1 block text-xs font-medium text-gray-600">Keep for (days)</label>
            <input
              type="number"
              min={30}
              max={3650}
              step={1}
              required
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
              className={`${inputClass} max-w-[160px]`}
            />
            <p className="mt-2 text-[11px] text-gray-500">
              30–3650 days. Every night, GPS points and driving events (harsh braking, phone use…) older than this are
              permanently deleted. Trips, jobs, alerts, expenses and inspections are kept.
            </p>
          </fieldset>
          {canEdit && <SaveRow {...retentionSection} disabled={false} />}
        </form>
      </Card>
    </div>
  );
}
