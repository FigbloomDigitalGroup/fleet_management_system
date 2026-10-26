"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { FiCopy, FiEdit2, FiTrash2, FiXCircle, FiZap, FiEye } from "react-icons/fi";
import { apiRequest, errorMessage } from "../lib/api";
import { useAdminAccess } from "../lib/adminAccess";
import { nairobiTodayKey, formatTime } from "../lib/dateKeys";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_STYLES,
  OPEN_JOB_STATUSES,
  formatWindow,
  isoToNairobiTime,
  windowToIso,
} from "../lib/jobStatus";
import { DriverRecord, JobRecord, OptimizeResult } from "../types/auth";
import Skeleton from "./Skeleton";
import JobDetailModal from "./JobDetailModal";
import JobsMap, { driverColor } from "./JobsMap";

const inputClass =
  "w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";

interface JobForm {
  title: string;
  address: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  driverId: string;
  scheduledDate: string;
  windowStart: string;
  windowEnd: string;
}

const emptyForm = (date: string): JobForm => ({
  title: "",
  address: "",
  contactName: "",
  contactPhone: "",
  notes: "",
  driverId: "",
  scheduledDate: date,
  windowStart: "",
  windowEnd: "",
});

const UNASSIGNED = "unassigned";

// Dispatch board shared by the owner and admin portals: the day's jobs per
// driver in run order, plus a form to add or edit one.
export default function JobsBoard() {
  const { canDispatch } = useAdminAccess();
  const [date, setDate] = useState(nairobiTodayKey);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<JobRecord | null>(null);
  const [optimizing, setOptimizing] = useState<string | null>(null);
  const [optimizeResults, setOptimizeResults] = useState<Record<string, OptimizeResult>>({});

  const [form, setForm] = useState<JobForm>(() => emptyForm(nairobiTodayKey()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<JobRecord[]>(`/api/jobs?date=${date}`);
      setJobs(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load jobs"));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    setOptimizeResults({});
    load();
    // Drivers update job status from the road — keep the board current.
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    apiRequest<DriverRecord[]>("/api/users/drivers").then(setDrivers).catch(() => {});
  }, []);

  // Keep the new-job form on the board's day unless the user is editing.
  useEffect(() => {
    if (!editingId) setForm((f) => ({ ...f, scheduledDate: date }));
  }, [date, editingId]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; jobs: JobRecord[] }>();
    for (const job of jobs) {
      const key = job.driverId?._id ?? UNASSIGNED;
      if (!map.has(key)) map.set(key, { key, name: job.driverId?.fullName ?? "Unassigned", jobs: [] });
      map.get(key)!.jobs.push(job);
    }
    const list = [...map.values()];
    list.forEach((g) => g.jobs.sort((a, b) => a.sequence - b.sequence));
    // Unassigned jobs go last — they need a driver before anything else.
    return list.sort((a, b) => (a.key === UNASSIGNED ? 1 : b.key === UNASSIGNED ? -1 : a.name.localeCompare(b.name)));
  }, [jobs]);

  const colorIndex = useMemo(() => new Map(groups.map((g, i) => [g.key, i])), [groups]);
  const colorFor = useCallback(
    (job: JobRecord) =>
      (job.driverId?._id ?? UNASSIGNED) === UNASSIGNED ? "#6b7280" : driverColor(colorIndex.get(job.driverId!._id) ?? 0),
    [colorIndex]
  );

  function setField<K extends keyof JobForm>(key: K, value: JobForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(job: JobRecord) {
    setEditingId(job._id);
    setFormError(null);
    setForm({
      title: job.title,
      address: job.address,
      contactName: job.contactName ?? "",
      contactPhone: job.contactPhone ?? "",
      notes: job.notes ?? "",
      driverId: job.driverId?._id ?? "",
      scheduledDate: job.scheduledDate,
      windowStart: isoToNairobiTime(job.windowStart),
      windowEnd: isoToNairobiTime(job.windowEnd),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormError(null);
    setForm(emptyForm(date));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (form.windowStart && form.windowEnd && form.windowEnd <= form.windowStart) {
      setFormError("The window has to end after it starts.");
      return;
    }
    setSaving(true);
    const editing = editingId ? jobs.find((j) => j._id === editingId) : null;
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      contactName: form.contactName.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      notes: form.notes.trim() || null,
      driverId: form.driverId || null,
      scheduledDate: form.scheduledDate,
      windowStart: windowToIso(form.scheduledDate, form.windowStart),
      windowEnd: windowToIso(form.scheduledDate, form.windowEnd),
    };
    // Only send the address when it changed — the server re-geocodes it.
    if (!editing || editing.address !== form.address.trim()) body.address = form.address.trim();
    try {
      if (editing) {
        await apiRequest(`/api/jobs/${editing._id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiRequest("/api/jobs", { method: "POST", body: JSON.stringify(body) });
      }
      setEditingId(null);
      setForm(emptyForm(date));
      if (form.scheduledDate !== date) setDate(form.scheduledDate);
      else await load();
    } catch (err) {
      setFormError(errorMessage(err, "Failed to save job"));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(job: JobRecord, action: () => Promise<unknown>) {
    setActionError(null);
    setBusyId(job._id);
    try {
      await action();
      await load();
    } catch (err) {
      setActionError(errorMessage(err, "Something went wrong"));
    } finally {
      setBusyId(null);
    }
  }

  function cancelJob(job: JobRecord) {
    if (!confirm(`Cancel "${job.title}"? The driver will no longer see it.`)) return;
    runAction(job, () => apiRequest(`/api/jobs/${job._id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }));
  }

  function deleteJob(job: JobRecord) {
    if (!confirm(`Delete "${job.title}" permanently? Its customer link will stop working.`)) return;
    if (editingId === job._id) cancelEdit();
    runAction(job, () => apiRequest(`/api/jobs/${job._id}`, { method: "DELETE" }));
  }

  async function copyLink(job: JobRecord) {
    const link = `${window.location.origin}${job.trackingPath}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(job._id);
      setTimeout(() => setCopiedId((id) => (id === job._id ? null : id)), 2000);
    } catch {
      // Clipboard can be blocked (e.g. plain http) — let them copy it by hand.
      prompt("Copy the customer tracking link:", link);
    }
  }

  async function optimize(driverId: string) {
    setActionError(null);
    setOptimizing(driverId);
    try {
      const result = await apiRequest<OptimizeResult>("/api/jobs/optimize", {
        method: "POST",
        body: JSON.stringify({ driverId, date }),
      });
      setOptimizeResults((r) => ({ ...r, [driverId]: result }));
      await load();
    } catch (err) {
      setActionError(errorMessage(err, "Failed to optimize route"));
    } finally {
      setOptimizing(null);
    }
  }

  const openCount = jobs.filter((j) => OPEN_JOB_STATUSES.includes(j.status)).length;
  const doneCount = jobs.filter((j) => j.status === "completed").length;
  const mappable = jobs.filter((j) => j.status !== "cancelled" && Number.isFinite(j.latitude) && Number.isFinite(j.longitude));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white px-5 py-3 shadow-sm ring-1 ring-black/5">
          <label className="text-xs font-medium text-gray-600">Day</label>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-teal-600"
          />
          <button
            type="button"
            onClick={() => setDate(nairobiTodayKey())}
            className="text-xs font-medium text-teal-600 hover:underline"
          >
            Today
          </button>
          <span className="ml-auto text-xs text-gray-500">
            {jobs.length} job{jobs.length === 1 ? "" : "s"} · {openCount} open · {doneCount} completed
          </span>
        </div>

        {actionError && (
          <p className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
            {actionError}
            <button onClick={() => setActionError(null)} className="font-medium hover:underline">
              Dismiss
            </button>
          </p>
        )}

        {loading && <Skeleton rows={4} rowClassName="h-16" className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5" />}
        {error && <p className="rounded-lg bg-white p-5 text-sm text-red-600 shadow-sm ring-1 ring-black/5">{error}</p>}

        {!loading && !error && groups.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center text-sm text-gray-400 shadow-sm ring-1 ring-black/5">
            No jobs scheduled for this day yet.
          </div>
        )}

        {!loading &&
          !error &&
          groups.map((group) => {
            const result = optimizeResults[group.key];
            const hasOpen = group.jobs.some((j) => j.status === "assigned");
            return (
              <div key={group.key} className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
                <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: group.key === UNASSIGNED ? "#6b7280" : driverColor(colorIndex.get(group.key) ?? 0) }}
                  />
                  <h3 className="text-sm font-bold text-blue-950">{group.name}</h3>
                  <span className="text-xs text-gray-500">
                    {group.jobs.length} stop{group.jobs.length === 1 ? "" : "s"}
                    {group.jobs[0]?.vehicleId ? ` · ${group.jobs[0].vehicleId.plateNumber}` : ""}
                  </span>
                  {canDispatch && group.key !== UNASSIGNED && (
                    <button
                      onClick={() => optimize(group.key)}
                      disabled={optimizing === group.key || !hasOpen}
                      title={hasOpen ? "Reorder this driver's not-yet-started jobs into the shortest run" : "No unstarted jobs to reorder"}
                      className="ml-auto inline-flex items-center gap-1.5 rounded bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      <FiZap size={12} />
                      {optimizing === group.key ? "Optimizing…" : "Optimize route"}
                    </button>
                  )}
                </div>
                {result && (
                  <p className="border-b border-gray-100 bg-teal-50 px-5 py-2 text-xs text-teal-700">
                    Optimized run: <span className="font-bold">{result.distanceKm} km</span>
                    {result.estimatedFinishAt && (
                      <>
                        {" "}
                        · estimated finish <span className="font-bold">{formatTime(result.estimatedFinishAt)}</span>
                      </>
                    )}
                    {result.lateMinutes > 0 && (
                      <span className="text-orange-600"> · {result.lateMinutes} min past time windows</span>
                    )}
                    {result.startedFrom === "first_stop" && " · from the first stop (vehicle has no location yet)"}
                  </p>
                )}
                <ul>
                  {group.jobs.map((job) => {
                    const open = OPEN_JOB_STATUSES.includes(job.status);
                    return (
                      <li
                        key={job._id}
                        className={`flex flex-wrap items-start gap-3 border-t border-gray-100 px-5 py-3 first:border-t-0 ${
                          editingId === job._id ? "bg-orange-50/50" : ""
                        }`}
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {job.sequence}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setSelected(job)}
                              className="text-left text-sm font-medium text-blue-950 hover:text-teal-600 hover:underline"
                            >
                              {job.title}
                            </button>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${JOB_STATUS_STYLES[job.status]}`}>
                              {JOB_STATUS_LABELS[job.status]}
                            </span>
                            {job.late && (
                              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600">
                                Late
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-gray-500">{job.address}</p>
                          <p className="mt-0.5 text-xs text-teal-600">
                            {formatWindow(job.windowStart, job.windowEnd)}
                            {job.contactName ? ` · ${job.contactName}` : ""}
                            {job.contactPhone ? ` · ${job.contactPhone}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton label="Details" onClick={() => setSelected(job)} icon={<FiEye size={14} />} />
                          <IconButton
                            label={copiedId === job._id ? "Copied!" : "Copy customer link"}
                            onClick={() => copyLink(job)}
                            icon={<FiCopy size={14} />}
                            active={copiedId === job._id}
                          />
                          {canDispatch && open && (
                            <>
                              <IconButton label="Edit" onClick={() => startEdit(job)} icon={<FiEdit2 size={14} />} disabled={busyId === job._id} />
                              <IconButton label="Cancel job" onClick={() => cancelJob(job)} icon={<FiXCircle size={14} />} disabled={busyId === job._id} />
                            </>
                          )}
                          {canDispatch && (
                            <IconButton
                              label="Delete"
                              onClick={() => deleteJob(job)}
                              icon={<FiTrash2 size={14} />}
                              disabled={busyId === job._id}
                              danger
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
      </div>

      <div className="space-y-4">
        {canDispatch && (
          <div className="h-fit rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h3 className="text-sm font-medium text-gray-700">{editingId ? "Edit job" : "New job"}</h3>
            <p className="mb-4 mt-0.5 text-xs text-teal-600">
              We find the address on the map for you. Times are Nairobi time.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                <input required value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Deliver 3 cartons" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Address</label>
                <input
                  required
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="Sarit Centre, Westlands, Nairobi"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Contact name</label>
                  <input value={form.contactName} onChange={(e) => setField("contactName", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Contact phone</label>
                  <input type="tel" value={form.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Driver</label>
                <select value={form.driverId} onChange={(e) => setField("driverId", e.target.value)} className={inputClass}>
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
                <input
                  type="date"
                  required
                  value={form.scheduledDate}
                  onChange={(e) => setField("scheduledDate", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Window start</label>
                  <input type="time" value={form.windowStart} onChange={(e) => setField("windowStart", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Window end</label>
                  <input type="time" value={form.windowEnd} onChange={(e) => setField("windowEnd", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes for the driver</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setField("notes", e.target.value)} className={inputClass} />
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}

              <div className="flex gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 rounded border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Discard
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add job"}
                </button>
              </div>
            </form>
          </div>
        )}

        {mappable.length > 0 && (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
            <p className="px-4 pt-3 text-xs text-teal-600">Stops for the day, numbered in run order</p>
            <div className="mt-2 h-72 w-full">
              <JobsMap jobs={mappable} colorFor={colorFor} onSelect={setSelected} />
            </div>
          </div>
        )}
      </div>

      {selected && <JobDetailModal job={jobs.find((j) => j._id === selected._id) ?? selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  icon,
  disabled,
  danger,
  active,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`rounded p-1.5 transition-colors disabled:opacity-40 ${
        active
          ? "bg-teal-50 text-teal-600"
          : danger
            ? "text-gray-400 hover:bg-red-50 hover:text-red-600"
            : "text-gray-400 hover:bg-gray-100 hover:text-teal-600"
      }`}
    >
      {icon}
    </button>
  );
}
