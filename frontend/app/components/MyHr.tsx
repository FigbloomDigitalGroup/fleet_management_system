"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { FiCalendar, FiFileText, FiPrinter, FiTarget, FiUser } from "react-icons/fi";
import { ApiError, apiRequest, errorMessage } from "../lib/api";
import { usePageHeader } from "./DashboardShell";
import Skeleton from "./Skeleton";
import EmptyState from "./EmptyState";

// My HR (FLEET_HR_CONTRACT.md section 3): the signed-in person's own record
// from Figbloom HR: payslips (view and print or save as PDF), leave (balances,
// apply with HR's own form and rules, cancel), attendance and KPIs. Fleet
// asks HR as this person only (/api/hr/my/*); HR decides what is shown.

// HR's answers, read defensively (fields may be missing or null).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
type Tab = "summary" | "payslips" | "leave" | "attendance" | "kpis";

const TABS: { key: Tab; label: string; icon: typeof FiUser }[] = [
  { key: "summary", label: "Summary", icon: FiUser },
  { key: "payslips", label: "Payslips", icon: FiFileText },
  { key: "leave", label: "Leave", icon: FiCalendar },
  { key: "attendance", label: "Attendance", icon: FiCalendar },
  { key: "kpis", label: "KPIs", icon: FiTarget },
];

const CARD = "rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5";
const INPUT = "w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";

function money(value: unknown, currency?: string) {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return "–";
  return `${currency ? `${currency} ` : ""}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const day = (v: unknown) => (typeof v === "string" && v ? new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "–");
const time = (v: unknown) => (typeof v === "string" && v ? new Date(v).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "–");
const label = (s: unknown) => String(s ?? "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// GET /api/hr/my/<path>; HR's "not ready" answers come back as a status.
function useMyHr<T extends Json>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "pending" | "not_linked" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const d = await apiRequest<T>(`/api/hr/my/${path}`, { notifyErrors: false });
      setData(d);
      setState(d?.status === "pending_hr" ? "pending" : "ok");
    } catch (err) {
      const code = (err as ApiError).data?.code;
      if (code === "not_linked") setState("not_linked");
      else {
        setError(errorMessage(err, "Couldn't load this from Figbloom HR."));
        setState("error");
      }
    }
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<T>(`/api/hr/my/${path}`, { notifyErrors: false })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState(d?.status === "pending_hr" ? "pending" : "ok");
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as ApiError).data?.code === "not_linked") setState("not_linked");
        else {
          setError(errorMessage(err, "Couldn't load this from Figbloom HR."));
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, state, error, reload: load };
}

function NotReady({ state, error }: { state: string; error: string | null }) {
  if (state === "loading") return <Skeleton rows={4} rowClassName="h-10" className="p-5" />;
  if (state === "pending" || state === "not_linked") {
    return (
      <EmptyState
        icon={FiUser}
        title="Your HR record isn't ready yet"
        text="Your company's HR team is still setting up your record in Figbloom HR. Your payslips, leave and attendance show here once they approve it."
      />
    );
  }
  return (
    <p role="alert" className="p-5 text-sm text-red-600">
      {error}
    </p>
  );
}

function Summary() {
  const { data, state, error } = useMyHr<Json>("summary");
  if (state !== "ok" || !data) return <NotReady state={state} error={error} />;
  const e = data.employee ?? {};
  const p = data.latest_payslip;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className={CARD}>
        <h3 className="text-sm font-medium text-gray-700">Your record</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {[
            ["Name", e.name],
            ["Employee number", e.employee_number],
            ["Job title", e.job_title],
            ["Department", e.department],
            ["Branch", e.branch],
            ["Started", e.start_date ? day(e.start_date) : null],
            ["Company", data.company?.name],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-gray-500">{k}</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{v || "–"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={CARD}>
        <h3 className="text-sm font-medium text-gray-700">At a glance</h3>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Latest payslip</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{p ? `${p.pay_period}: ${money(p.net_pay, p.currency)} net` : "None yet"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Leave requests waiting</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{data.leave_pending ?? 0}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// Payslips: HR doesn't make PDFs, so a payslip opens in a printable window
// (Print, or Save as PDF from the print dialog).
function printPayslip(p: Json, name: string) {
  const skip = new Set(["id", "employee_id", "tenant_id", "run_id", "created_at", "updated_at"]);
  const rows = Object.entries(p)
    .filter(([k, v]) => !skip.has(k) && v != null && typeof v !== "object")
    .map(([k, v]) => {
      const n = typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) ? money(v) : esc(v);
      return `<tr><th>${esc(label(k))}</th><td>${n}</td></tr>`;
    })
    .join("");
  const w = window.open("", "_blank", "noopener=no,width=720,height=900");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(p.pay_period)}</title>
<style>body{font:14px system-ui,sans-serif;color:#111;margin:32px}h1{font-size:18px;margin:0}p{color:#555;margin:4px 0 20px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e5e7eb}th{color:#555;font-weight:500;width:50%}
.net td,.net th{font-weight:700;color:#111}</style></head><body>
<h1>Payslip: ${esc(p.pay_period)}</h1><p>${esc(name)} · ${esc(p.currency ?? "")}</p>
<table>${rows}<tr class="net"><th>Net pay</th><td>${money(p.net_pay, p.currency)}</td></tr></table>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}

function Payslips() {
  const { data, state, error } = useMyHr<Json>("payslips");
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  if (state !== "ok" || !data) return <NotReady state={state} error={error} />;
  const list: Json[] = data.payslips ?? [];

  async function open(id: string, period: string) {
    setRowError(null);
    setBusy(id);
    try {
      const d = await apiRequest<Json>(`/api/hr/my/payslips/${encodeURIComponent(id)}`, { notifyErrors: false });
      if (!printPayslip(d.payslip ?? {}, period)) setRowError("Allow pop-ups for this site to print the payslip.");
    } catch (err) {
      setRowError(errorMessage(err, "Couldn't open that payslip."));
    } finally {
      setBusy(null);
    }
  }

  if (list.length === 0) return <EmptyState icon={FiFileText} title="No payslips yet" text="Payslips show here once your company's payroll is approved in Figbloom HR." />;
  return (
    <div className={`${CARD} overflow-x-auto p-0`}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-5 py-3 text-left font-medium">Period</th>
            <th className="px-5 py-3 text-right font-medium">Gross</th>
            <th className="px-5 py-3 text-right font-medium">Deductions</th>
            <th className="px-5 py-3 text-right font-medium">Net</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="border-t border-gray-100">
              <td className="px-5 py-3 font-medium text-gray-900">
                {p.pay_period}
                {p.run_status === "paid" && <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700">Paid</span>}
              </td>
              <td className="px-5 py-3 text-right">{money(p.gross_pay, p.currency)}</td>
              <td className="px-5 py-3 text-right">{money(p.total_deductions, p.currency)}</td>
              <td className="px-5 py-3 text-right font-semibold">{money(p.net_pay, p.currency)}</td>
              <td className="px-5 py-3 text-right">
                <button
                  type="button"
                  onClick={() => open(p.id, p.pay_period)}
                  disabled={busy === p.id}
                  className="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
                >
                  <FiPrinter size={12} aria-hidden /> {busy === p.id ? "Opening…" : "View & print"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rowError && <p className="px-5 pb-4 text-xs text-red-600">{rowError}</p>}
    </div>
  );
}

function readFile(file: File): Promise<{ name: string; content_type: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, content_type: file.type || "application/octet-stream", base64: String(r.result).split(",")[1] ?? "" });
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
}

function Leave() {
  const leave = useMyHr<Json>("leave");
  const form = useMyHr<Json>("leave/form");
  const [typeId, setTypeId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string[] | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  if (leave.state !== "ok" || !leave.data) return <NotReady state={leave.state} error={leave.error} />;
  const balances: Json[] = leave.data.balances ?? [];
  const apps: Json[] = leave.data.applications ?? [];
  const types: Json[] = (form.data?.leave_types ?? leave.data.leave_types ?? []) as Json[];
  const chosen = types.find((t) => t.id === typeId);

  async function apply(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (file && file.size > 5 * 1024 * 1024) {
      setFormError(["The document can be 5 MB at most."]);
      return;
    }
    setSubmitting(true);
    try {
      const document = file ? await readFile(file) : undefined;
      await apiRequest("/api/hr/my/leave/applications", {
        method: "POST",
        body: JSON.stringify({ type_id: typeId, start_date: start, end_date: end || start, half_day: halfDay, reason, ...(document ? { document } : {}) }),
        successMessage: "Leave request sent.",
        notifyErrors: false,
      });
      setTypeId("");
      setStart("");
      setEnd("");
      setHalfDay(false);
      setReason("");
      setFile(null);
      leave.reload();
      form.reload();
    } catch (err) {
      const problems = (err as ApiError).data?.problems;
      setFormError(Array.isArray(problems) && problems.length ? problems.map(String) : [errorMessage(err, "Couldn't send the request.")]);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this leave request?")) return;
    setCancelling(id);
    try {
      await apiRequest(`/api/hr/my/leave/applications/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}", successMessage: "Leave request cancelled." });
      leave.reload();
      form.reload();
    } catch {
      /* shown as a popup */
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className={`${CARD} overflow-x-auto p-0`}>
          <h3 className="px-5 pt-4 text-sm font-medium text-gray-700">Balances</h3>
          {balances.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">No leave balances yet.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">Type</th>
                  <th className="px-5 py-2 text-right font-medium">Used</th>
                  <th className="px-5 py-2 text-right font-medium">Waiting</th>
                  <th className="px-5 py-2 text-right font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={`${b.leave_type_id}-${b.year}-${b.month ?? ""}`} className="border-t border-gray-100">
                    <td className="px-5 py-2 font-medium text-gray-900">{b.leave_type}</td>
                    <td className="px-5 py-2 text-right">{b.used_days ?? 0}</td>
                    <td className="px-5 py-2 text-right">{b.pending_days ?? 0}</td>
                    <td className="px-5 py-2 text-right font-semibold">{b.available_days ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className={`${CARD} overflow-x-auto p-0`}>
          <h3 className="px-5 pt-4 text-sm font-medium text-gray-700">Your requests</h3>
          {apps.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">No leave requests yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {apps.map((a) => {
                const waiting = a.approval?.steps?.find((s: Json) => s.status === "current");
                const cancellable = a.cancellable ?? ["pending", "approved"].includes(a.status);
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span>
                      <span className="block font-medium text-gray-900">
                        {a.leave_type}: {day(a.start_date)}
                        {a.end_date && a.end_date !== a.start_date ? ` to ${day(a.end_date)}` : ""} ({a.days} day{Number(a.days) === 1 ? "" : "s"})
                      </span>
                      <span className="block text-xs text-gray-500">
                        {label(a.status)}
                        {waiting ? `, waiting on ${waiting.waiting_on || waiting.label}` : ""}
                      </span>
                    </span>
                    {cancellable && (
                      <button
                        type="button"
                        onClick={() => cancel(a.id)}
                        disabled={cancelling === a.id}
                        className="text-xs font-medium text-gray-600 underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        {cancelling === a.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <form onSubmit={apply} className={`${CARD} h-fit space-y-4`}>
        <h3 className="text-sm font-medium text-gray-700">Apply for leave</h3>
        <div>
          <label htmlFor="leave-type" className="mb-1 block text-xs font-medium text-gray-600">Type</label>
          <select id="leave-type" required value={typeId} onChange={(e) => setTypeId(e.target.value)} className={INPUT}>
            <option value="">Choose…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {chosen?.description && <p className="mt-1 text-[11px] text-gray-500">{chosen.description}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="leave-start" className="mb-1 block text-xs font-medium text-gray-600">From</label>
            <input id="leave-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="leave-end" className="mb-1 block text-xs font-medium text-gray-600">To</label>
            <input id="leave-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={INPUT} />
          </div>
        </div>
        {(chosen?.half_days ?? true) && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} className="accent-teal-600" /> Half day
          </label>
        )}
        <div>
          <label htmlFor="leave-reason" className="mb-1 block text-xs font-medium text-gray-600">Reason</label>
          <textarea id="leave-reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="leave-doc" className="mb-1 block text-xs font-medium text-gray-600">Document (optional, 5 MB at most)</label>
          <input id="leave-doc" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-xs text-gray-600" />
        </div>
        {formError && (
          <ul role="alert" className="list-disc space-y-1 pl-4 text-xs text-red-600">
            {formError.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        <button type="submit" disabled={submitting || !typeId} className="w-full rounded bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60">
          {submitting ? "Sending…" : "Send request"}
        </button>
        <p className="text-[11px] text-gray-500">HR&apos;s own rules apply (notice, balances, documents), and it goes to your approvers in Figbloom HR.</p>
      </form>
    </div>
  );
}

function monthRange() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { from, to };
}

function Attendance() {
  const { from, to } = monthRange();
  const { data, state, error } = useMyHr<Json>(`attendance?from=${from}&to=${to}`);
  if (state !== "ok" || !data) return <NotReady state={state} error={error} />;
  const days: Json[] = data.days ?? [];
  const count = (s: string) => days.filter((d) => d.status === s).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Present", count("present")],
          ["Late", count("late")],
          ["Absent", count("absent")],
          ["On leave", count("leave")],
        ].map(([k, v]) => (
          <div key={k} className={CARD}>
            <p className="text-xs text-gray-500">{k}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{v}</p>
          </div>
        ))}
      </div>
      <div className={`${CARD} overflow-x-auto p-0`}>
        <h3 className="px-5 pt-4 text-sm font-medium text-gray-700">This month</h3>
        {days.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">No attendance recorded this month.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Day</th>
                <th className="px-5 py-2 text-left font-medium">Status</th>
                <th className="px-5 py-2 text-left font-medium">In</th>
                <th className="px-5 py-2 text-left font-medium">Out</th>
                <th className="px-5 py-2 text-right font-medium">Late</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t border-gray-100">
                  <td className="px-5 py-2">{day(d.day)}</td>
                  <td className="px-5 py-2">{label(d.status)}</td>
                  <td className="px-5 py-2">{time(d.clock_in)}</td>
                  <td className="px-5 py-2">{time(d.clock_out)}</td>
                  <td className="px-5 py-2 text-right">{d.late_minutes ? `${d.late_minutes} min` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpis() {
  const { data, state, error } = useMyHr<Json>("kpis");
  if (state !== "ok" || !data) return <NotReady state={state} error={error} />;
  const items: Json[] = data.items ?? [];
  if (!data.period || items.length === 0) return <EmptyState icon={FiTarget} title="No KPIs yet" text="Your targets show here once HR opens a KPI period for you." />;
  return (
    <div className={`${CARD} overflow-x-auto p-0`}>
      <h3 className="px-5 pt-4 text-sm font-medium text-gray-700">
        {data.period.name} ({day(data.period.starts_on)} to {day(data.period.ends_on)})
      </h3>
      <table className="mt-2 w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-5 py-2 text-left font-medium">KPI</th>
            <th className="px-5 py-2 text-right font-medium">Target</th>
            <th className="px-5 py-2 text-right font-medium">Result</th>
            <th className="px-5 py-2 text-right font-medium">Weight</th>
          </tr>
        </thead>
        <tbody>
          {items.map((k) => {
            const result = k.actual_value ?? k.auto_value ?? k.self_value;
            return (
              <tr key={k.assignment_id ?? k.kpi_id} className="border-t border-gray-100">
                <td className="px-5 py-2">
                  <span className="block font-medium text-gray-900">{k.name}</span>
                  {k.description && <span className="block text-xs text-gray-500">{k.description}</span>}
                </td>
                <td className="px-5 py-2 text-right">
                  {k.target ?? "–"} {k.unit ?? ""}
                </td>
                <td className="px-5 py-2 text-right">{result != null ? `${result} ${k.unit ?? ""}` : "–"}</td>
                <td className="px-5 py-2 text-right">{k.weight != null ? `${k.weight}%` : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MyHr() {
  const [tab, setTab] = useState<Tab>("summary");
  usePageHeader("My HR", "Your payslips, leave, attendance and KPIs from Figbloom HR");

  return (
    <div>
      <div className="mb-4 overflow-x-auto">
        <div className="inline-flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5" role="tablist" aria-label="My HR">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <t.icon size={14} aria-hidden /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "summary" && <Summary />}
      {tab === "payslips" && <Payslips />}
      {tab === "leave" && <Leave />}
      {tab === "attendance" && <Attendance />}
      {tab === "kpis" && <Kpis />}
    </div>
  );
}
