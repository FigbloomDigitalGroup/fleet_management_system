"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, errorMessage } from "../lib/api";
import { formatKes } from "../lib/pricing";
import { toDateInput } from "../lib/dateKeys";
import { MaintenanceItem, VehicleRecord } from "../types/auth";
import Skeleton from "./Skeleton";

const inputClass =
  "w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";

const STATE_STYLES: Record<string, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-red-50 text-red-600 border-red-200" },
  due_soon: { label: "Due soon", className: "bg-orange-50 text-orange-600 border-orange-200" },
  upcoming: { label: "Upcoming", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const numOrUndefined = (v: string) => (v.trim() === "" ? undefined : Number(v));

function dueSummary(r: MaintenanceItem) {
  const parts: string[] = [];
  if (r.dueDate) parts.push(`by ${new Date(r.dueDate).toLocaleDateString()}`);
  if (r.dueOdometerKm != null) parts.push(`at ${r.dueOdometerKm.toLocaleString()} km`);
  const repeat: string[] = [];
  if (r.intervalDays) repeat.push(`${r.intervalDays} days`);
  if (r.intervalKm) repeat.push(`${r.intervalKm.toLocaleString()} km`);
  return `Due ${parts.join(" or ") || "—"}${repeat.length ? ` · repeats every ${repeat.join(" / ")}` : ""}`;
}

// Service history, upcoming reminders and the odometer for one vehicle.
export default function VehicleMaintenance({ vehicleId, canEdit }: { vehicleId: string; canEdit: boolean }) {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [odometerKm, setOdometerKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [baseKm, setBaseKm] = useState("");
  const baseDirty = useRef(false);
  const [savingBase, setSavingBase] = useState(false);

  const [mode, setMode] = useState<"record" | "reminder">("reminder");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAt, setPerformedAt] = useState(() => toDateInput(new Date()));
  const [recordKm, setRecordKm] = useState("");
  const [costKes, setCostKes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueKm, setDueKm] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [intervalKm, setIntervalKm] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeKm, setCompleteKm] = useState("");
  const [completeCost, setCompleteCost] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, vehicle] = await Promise.all([
        apiRequest<{ odometerKm: number | null; items: MaintenanceItem[] }>(`/api/maintenance?vehicleId=${vehicleId}`),
        apiRequest<VehicleRecord>(`/api/vehicles/${vehicleId}`),
      ]);
      setItems(data.items);
      setOdometerKm(data.odometerKm);
      if (!baseDirty.current) setBaseKm(String(vehicle.odometerBaseKm ?? 0));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load maintenance"));
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveBase(e: FormEvent) {
    e.preventDefault();
    setSavingBase(true);
    setActionError(null);
    try {
      await apiRequest(`/api/vehicles/${vehicleId}`, {
        method: "PUT",
        body: JSON.stringify({ odometerBaseKm: Number(baseKm) }),
      });
      baseDirty.current = false;
      await load();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to save odometer"));
    } finally {
      setSavingBase(false);
    }
  }

  function resetForm() {
    setTitle("");
    setNotes("");
    setRecordKm("");
    setCostKes("");
    setDueDate("");
    setDueKm("");
    setIntervalDays("");
    setIntervalKm("");
    setPerformedAt(toDateInput(new Date()));
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const body: Record<string, unknown> = { vehicleId, kind: mode, title: title.trim(), notes: notes.trim() || undefined };
    if (mode === "record") {
      Object.assign(body, {
        performedAt: performedAt ? new Date(`${performedAt}T12:00:00`).toISOString() : undefined,
        odometerKm: numOrUndefined(recordKm),
        costKes: numOrUndefined(costKes),
      });
    } else {
      if (!dueDate && !dueKm && !intervalDays && !intervalKm) {
        setFormError("Give a due date, a due odometer reading, or a repeat interval.");
        return;
      }
      Object.assign(body, {
        dueDate: dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : undefined,
        dueOdometerKm: numOrUndefined(dueKm),
        intervalDays: numOrUndefined(intervalDays),
        intervalKm: numOrUndefined(intervalKm),
      });
    }
    setSaving(true);
    try {
      await apiRequest("/api/maintenance", { method: "POST", body: JSON.stringify(body) });
      resetForm();
      await load();
    } catch (err) {
      setFormError(errorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  function startComplete(r: MaintenanceItem) {
    setCompletingId(r._id);
    setCompleteKm(odometerKm != null ? String(odometerKm) : "");
    setCompleteCost("");
    setCompleteNotes("");
  }

  async function complete(e: FormEvent, r: MaintenanceItem) {
    e.preventDefault();
    setBusyId(r._id);
    setActionError(null);
    try {
      await apiRequest(`/api/maintenance/${r._id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          odometerKm: numOrUndefined(completeKm),
          costKes: numOrUndefined(completeCost),
          notes: completeNotes.trim() || undefined,
        }),
      });
      setCompletingId(null);
      await load();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to mark done"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: MaintenanceItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    setBusyId(item._id);
    setActionError(null);
    try {
      await apiRequest(`/api/maintenance/${item._id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to delete"));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Skeleton rows={3} rowClassName="h-12" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const reminders = items
    .filter((i) => i.kind === "reminder" && i.status === "open")
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, upcoming: 2 } as Record<string, number>;
      return (rank[a.state ?? "upcoming"] ?? 3) - (rank[b.state ?? "upcoming"] ?? 3);
    });
  const records = items
    .filter((i) => i.kind === "record")
    .sort((a, b) => new Date(b.performedAt ?? b.createdAt).getTime() - new Date(a.performedAt ?? a.createdAt).getTime());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs text-gray-500">Current odometer</p>
          <p className="text-[17px] font-bold text-blue-950">{odometerKm != null ? `${odometerKm.toLocaleString()} km` : "—"}</p>
          <p className="text-[11px] text-gray-400">Reading at onboarding + every trip recorded since</p>
        </div>
        {canEdit ? (
          <form onSubmit={saveBase} className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Odometer at onboarding (km)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={baseKm}
                onChange={(e) => {
                  setBaseKm(e.target.value);
                  baseDirty.current = true;
                }}
                className="w-44 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <button
              type="submit"
              disabled={savingBase}
              className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {savingBase ? "Saving…" : "Save"}
            </button>
          </form>
        ) : (
          <div>
            <p className="text-xs text-gray-500">At onboarding</p>
            <p className="text-sm font-medium text-gray-900">{Number(baseKm || 0).toLocaleString()} km</p>
          </div>
        )}
      </div>

      {actionError && <p className="text-xs text-red-600">{actionError}</p>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Reminders</h4>
            {reminders.length === 0 ? (
              <p className="text-sm text-gray-400">No open reminders.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded border border-gray-100">
                {reminders.map((r) => {
                  const state = STATE_STYLES[r.state ?? "upcoming"];
                  return (
                    <li key={r._id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-blue-950">{r.title}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${state.className}`}>{state.label}</span>
                        {canEdit && completingId !== r._id && (
                          <span className="ml-auto flex gap-3">
                            <button onClick={() => startComplete(r)} className="text-xs font-medium text-teal-600 hover:underline">
                              Mark done
                            </button>
                            <button
                              onClick={() => remove(r)}
                              disabled={busyId === r._id}
                              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-teal-600">{dueSummary(r)}</p>
                      {r.notes && <p className="mt-0.5 text-xs text-gray-500">{r.notes}</p>}
                      {completingId === r._id && (
                        <form onSubmit={(e) => complete(e, r)} className="mt-3 grid gap-2 rounded bg-gray-50 p-3 sm:grid-cols-4">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={completeKm}
                            onChange={(e) => setCompleteKm(e.target.value)}
                            placeholder="Odometer km"
                            className={inputClass}
                          />
                          <input
                            type="number"
                            min="0"
                            value={completeCost}
                            onChange={(e) => setCompleteCost(e.target.value)}
                            placeholder="Cost (KES)"
                            className={inputClass}
                          />
                          <input value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} placeholder="Notes" className={inputClass} />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setCompletingId(null)}
                              className="flex-1 rounded border border-gray-300 text-xs font-medium text-gray-600 hover:bg-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={busyId === r._id}
                              className="flex-1 rounded bg-teal-600 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                            >
                              {busyId === r._id ? "…" : "Done"}
                            </button>
                          </div>
                          {(r.intervalDays || r.intervalKm) && (
                            <p className="text-[11px] text-gray-500 sm:col-span-4">The next reminder is scheduled automatically.</p>
                          )}
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Service history</h4>
            {records.length === 0 ? (
              <p className="text-sm text-gray-400">No service records yet.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Service</th>
                      <th className="px-3 py-2 text-right font-medium">Odometer</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      {canEdit && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r._id} className="border-t border-gray-100">
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                          {r.performedAt ? new Date(r.performedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-blue-950">{r.title}</p>
                          {r.notes && <p className="text-xs text-gray-500">{r.notes}</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-gray-600">
                          {r.odometerKm != null ? `${r.odometerKm.toLocaleString()} km` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                          {r.costKes != null ? formatKes(r.costKes) : "—"}
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => remove(r)}
                              disabled={busyId === r._id}
                              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="h-fit rounded border border-gray-100 p-4">
            <div className="mb-3 flex rounded border border-gray-200 text-xs">
              {(["reminder", "record"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setFormError(null);
                  }}
                  className={`flex-1 px-2 py-1.5 font-medium ${mode === m ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {m === "reminder" ? "Add reminder" : "Log a service"}
                </button>
              ))}
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">What</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={mode === "reminder" ? "Oil change" : "Replaced brake pads"}
                  className={inputClass}
                />
              </div>
              {mode === "record" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Date done</label>
                    <input type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Odometer (km)</label>
                      <input type="number" min="0" step="0.1" value={recordKm} onChange={(e) => setRecordKm(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Cost (KES)</label>
                      <input type="number" min="0" value={costKes} onChange={(e) => setCostKes(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-gray-500">Set a due date, a due odometer, a repeat interval — or a mix.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Due date</label>
                      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Due at (km)</label>
                      <input type="number" min="0" value={dueKm} onChange={(e) => setDueKm(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Every (days)</label>
                      <input type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Every (km)</label>
                      <input type="number" min="1" value={intervalKm} onChange={(e) => setIntervalKm(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {saving ? "Saving…" : mode === "reminder" ? "Add reminder" : "Save record"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
