"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiDollarSign, FiDownload, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import EmptyState from "./EmptyState";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_URL, apiDownload, apiRequest, errorMessage } from "../lib/api";
import { DriverRecord, ExpenseList, ExpenseRecord, VehicleRecord } from "../types/auth";
import { formatKes } from "../lib/pricing";
import { useAdminAccess } from "../lib/adminAccess";
import { uploadImage } from "../lib/imageUpload";
import Skeleton from "./Skeleton";
import WheelIcon from "./WheelIcon";
import ModalSheet, { SHEET_ACTIONS } from "./ModalSheet";
import FiltersPanel from "./FiltersPanel";

type Category = ExpenseRecord["category"];

const CATEGORIES: Category[] = ["fuel", "toll", "parking", "repair", "other"];

const CATEGORY_LABELS: Record<Category, string> = {
  fuel: "Fuel",
  toll: "Toll",
  parking: "Parking",
  repair: "Repair",
  other: "Other",
};

const CATEGORY_STYLES: Record<Category, string> = {
  fuel: "bg-orange-50 text-orange-600 border-orange-200",
  toll: "bg-blue-50 text-blue-600 border-blue-200",
  parking: "bg-purple-50 text-purple-600 border-purple-200",
  repair: "bg-red-50 text-red-600 border-red-200",
  other: "bg-gray-100 text-gray-500 border-gray-200",
};

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

// "YYYY-MM-DD" of a moment, in this computer's time zone (what a date box shows).
const dayOf = (d: Date) => d.toLocaleDateString("en-CA");

interface Filters {
  from: string;
  to: string;
  vehicleId: string;
  driverId: string;
  category: string;
  checked: string;
}
const NO_FILTERS: Filters = { from: "", to: "", vehicleId: "", driverId: "", category: "", checked: "" };

const plate = (e: ExpenseRecord) => (typeof e.vehicleId === "object" ? e.vehicleId.plateNumber : "");
const idOf = (v: { _id: string } | string | null | undefined) => (v && typeof v === "object" ? v._id : v || "");

// Every expense in the fleet: the ones drivers log from the phone app (with
// a receipt photo) and the ones entered here in the office. The owner, full
// admins and accountants add, correct, delete and tick off drivers'
// expenses as checked; everyone else who can open this page only reads.
export default function ExpensesList() {
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/admin") ? "/admin/vehicles" : "/company/vehicles";
  const { canManageExpenses: canManage } = useAdminAccess();

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    return params.toString();
  }, [filters]);

  // The list as loaded for a query (and a reload count), so "loading" is
  // simply "not loaded for what's asked yet".
  const [reloads, setReloads] = useState(0);
  const wanted = `${query}#${reloads}`;
  const [loaded, setLoaded] = useState<{ key: string; data: ExpenseList | null; error: string | null } | null>(null);
  const loading = loaded?.key !== wanted;
  const data = loaded?.data ?? null;
  const error = loaded?.key === wanted ? loaded.error : null;

  useEffect(() => {
    let cancelled = false;
    apiRequest<ExpenseList>(`/api/expenses${query ? `?${query}` : ""}`)
      .then((list) => !cancelled && setLoaded({ key: wanted, data: list, error: null }))
      .catch((err) => !cancelled && setLoaded((prev) => ({ key: wanted, data: prev?.data ?? null, error: errorMessage(err, "Couldn't load expenses") })));
    return () => {
      cancelled = true;
    };
  }, [query, wanted]);
  const reload = () => setReloads((n) => n + 1);

  // Vehicles and drivers, for the filters and the form.
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  useEffect(() => {
    apiRequest<VehicleRecord[]>("/api/vehicles")
      .then((list) => setVehicles([...list].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))))
      .catch(() => {});
    apiRequest<DriverRecord[]>("/api/users/drivers")
      .then((list) => setDrivers([...list].sort((a, b) => a.fullName.localeCompare(b.fullName))))
      .catch(() => {});
  }, []);

  const [editing, setEditing] = useState<ExpenseRecord | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const setFilter = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const filtered = Object.values(filters).some(Boolean);

  async function remove(e: ExpenseRecord) {
    const what = `${CATEGORY_LABELS[e.category].toLowerCase()} expense of ${formatKes(e.amount)}${plate(e) ? ` for ${plate(e)}` : ""}`;
    if (!window.confirm(`Delete this ${what}? This can't be undone.`)) return;
    setBusyId(e._id);
    try {
      await apiRequest(`/api/expenses/${e._id}`, { method: "DELETE", successMessage: "Expense deleted." });
      reload();
    } catch {
      // apiRequest has shown why
    } finally {
      setBusyId(null);
    }
  }

  async function setChecked(e: ExpenseRecord, checked: boolean) {
    setBusyId(e._id);
    try {
      await apiRequest(`/api/expenses/${e._id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ checked }),
        successMessage: checked ? "Marked as checked." : "No longer marked as checked.",
      });
      reload();
    } catch {
      // apiRequest has shown why
    } finally {
      setBusyId(null);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await apiDownload(`/api/expenses/export.xlsx${query ? `?${query}` : ""}`, "fleet-expenses.xlsx");
    } catch {
      // apiDownload has shown why
    } finally {
      setDownloading(false);
    }
  }

  const expenses = data?.expenses ?? [];
  const categoriesWithSpend = data ? CATEGORIES.filter((c) => data.byCategory?.[c]) : [];

  return (
    <div className="space-y-4">
      {/* What to do: add, download */}
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            <FiPlus size={16} /> Add expense
          </button>
        )}
        <button
          onClick={download}
          disabled={downloading || !data || data.count === 0}
          title="Download the expenses shown below as an Excel file"
          className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
        >
          <FiDownload size={15} /> {downloading ? "Preparing…" : "Download Excel"}
        </button>
      </div>

      {canManage && !!data?.needsChecking && filters.checked !== "no" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <span>
            {data.needsChecking === 1
              ? "1 expense from a driver hasn't been checked yet."
              : `${data.needsChecking} expenses from drivers haven't been checked yet.`}
          </span>
          <button onClick={() => setFilters({ ...NO_FILTERS, checked: "no" })} className="font-medium text-orange-700 underline hover:text-orange-900">
            Show them
          </button>
        </div>
      )}

      {/* Filters (one "Filters" button on phones) */}
      <FiltersPanel activeCount={Object.values(filters).filter(Boolean).length}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className={labelClass} htmlFor="exp-from">From</label>
            <input id="exp-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter("from", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="exp-to">To</label>
            <input id="exp-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter("to", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="exp-vehicle">Vehicle</label>
            <select id="exp-vehicle" value={filters.vehicleId} onChange={(e) => setFilter("vehicleId", e.target.value)} className={inputClass}>
              <option value="">All vehicles</option>
              {vehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.plateNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="exp-driver">Driver</label>
            <select id="exp-driver" value={filters.driverId} onChange={(e) => setFilter("driverId", e.target.value)} className={inputClass}>
              <option value="">All drivers</option>
              {drivers.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="exp-category">Type</label>
            <select id="exp-category" value={filters.category} onChange={(e) => setFilter("category", e.target.value)} className={inputClass}>
              <option value="">All types</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="exp-checked">Checked</label>
            <select id="exp-checked" value={filters.checked} onChange={(e) => setFilter("checked", e.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="no">Drivers&apos; expenses not checked yet</option>
              <option value="yes">Checked</option>
            </select>
          </div>
        </div>
        {filtered && (
          <button onClick={() => setFilters(NO_FILTERS)} className="mt-3 min-h-9 text-xs font-medium text-teal-700 hover:underline">
            Clear filters
          </button>
        )}
      </FiltersPanel>

      {/* Totals for what's shown */}
      {data && (
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="rounded-lg bg-white px-5 py-3 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-gray-500">{filtered ? "Total for these filters" : "Total spent"}</p>
            <p className="text-lg font-bold text-gray-900">{formatKes(data.totalKes)}</p>
            <p className="text-[11px] text-gray-400">
              {data.count === 1 ? "1 expense" : `${data.count.toLocaleString()} expenses`}
            </p>
          </div>
          {categoriesWithSpend.length > 1 &&
            categoriesWithSpend.map((c) => (
              <div key={c} className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
                <p className="text-xs text-gray-500">{CATEGORY_LABELS[c]}</p>
                <p className="text-sm font-semibold text-gray-900">{formatKes(data.byCategory[c])}</p>
              </div>
            ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        {loading && !data && <Skeleton rows={6} rowClassName="h-12" className="p-5" />}
        {error && <p className="p-5 text-sm text-red-600">{error}</p>}
        {data && (
          <div className={`table-scroll transition-opacity ${loading ? "opacity-60" : ""}`}>
            <table className="table-cards w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium">Driver</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Note</th>
                  <th className="px-4 py-3 text-left font-medium">Receipt</th>
                  <th className="px-4 py-3 text-left font-medium">Entered by</th>
                  <th className="px-4 py-3 text-left font-medium">Checked</th>
                  {canManage && <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>}
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 10 : 9}>
                      {filtered ? (
                        <EmptyState icon={FiDollarSign} title="Nothing matches these filters" text="Try a wider date range, or clear the filters to see every expense." />
                      ) : (
                        <EmptyState
                          icon={FiDollarSign}
                          title="No expenses yet"
                          text={
                            canManage
                              ? "Drivers log fuel, tolls, parking and repairs from the phone app, with a photo of the receipt. You can also add one here with “Add expense”."
                              : "Drivers log fuel, tolls, parking and repairs from the phone app, with a photo of the receipt. They show up here."
                          }
                          action={{ label: "About the driver app", href: "/help#driver-app" }}
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e._id} className="border-t border-gray-100 align-top">
                      <td data-label="Date" className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {new Date(e.incurredAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td data-label="Vehicle" className="px-4 py-3 text-xs font-bold text-gray-900">
                        {typeof e.vehicleId === "object" ? (
                          <Link href={`${basePath}/${e.vehicleId._id}`} className="inline-flex items-center gap-2 whitespace-nowrap hover:text-teal-600">
                            <WheelIcon size={16} className="spin-slow shrink-0" />
                            {e.vehicleId.plateNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td data-label="Driver" className="px-4 py-3 text-gray-600">{typeof e.driverId === "object" && e.driverId ? e.driverId.fullName : "—"}</td>
                      <td data-label="Type" className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-xs ${CATEGORY_STYLES[e.category]}`}>{CATEGORY_LABELS[e.category]}</span>
                      </td>
                      <td data-label="Amount" className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{formatKes(e.amount)}</td>
                      <td data-label="Note" className="max-w-[220px] px-4 py-3 text-gray-500">{e.note || "—"}</td>
                      <td data-label="Receipt" className="px-4 py-3">
                        {e.receiptUrl ? (
                          <a href={API_URL + e.receiptUrl} target="_blank" rel="noreferrer" title="Open receipt photo" className="block w-fit">
                            {/* eslint-disable-next-line @next/next/no-img-element -- a signed API image, not a static asset */}
                            <img src={API_URL + e.receiptUrl} alt="Receipt" className="h-10 w-10 rounded object-cover ring-1 ring-black/10 hover:ring-teal-600" />
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td data-label="Entered by" className="px-4 py-3 text-xs text-gray-600">
                        {e.fromDriverApp !== false ? "Driver (phone app)" : e.enteredBy?.fullName ?? "Office"}
                      </td>
                      <td data-label="Checked" className="px-4 py-3 text-xs">
                        <CheckedCell expense={e} canManage={canManage} busy={busyId === e._id} onChange={(checked) => setChecked(e, checked)} />
                      </td>
                      {canManage && (
                        <td className="card-actions whitespace-nowrap px-4 py-3 text-right">
                          <button
                            onClick={() => setEditing(e)}
                            disabled={busyId === e._id}
                            title="Edit this expense"
                            className="inline-flex min-h-9 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                          >
                            <FiEdit2 size={13} /> Edit
                          </button>
                          <button
                            onClick={() => remove(e)}
                            disabled={busyId === e._id}
                            title="Delete this expense"
                            className="ml-1 inline-flex min-h-9 items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <FiTrash2 size={13} /> Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {data.count > expenses.length && (
              <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                Showing the latest {expenses.length.toLocaleString()} of {data.count.toLocaleString()} expenses. The total above covers all of them; pick dates to
                narrow the list, or download Excel for every row.
              </p>
            )}
          </div>
        )}
      </div>

      {editing && (
        <ExpenseForm
          expense={editing === "new" ? null : editing}
          vehicles={vehicles}
          drivers={drivers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

// A driver's expense: ticked off by the office, or not yet. Office-entered
// ones need no check.
function CheckedCell({
  expense: e,
  canManage,
  busy,
  onChange,
}: {
  expense: ExpenseRecord;
  canManage: boolean;
  busy: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (e.fromDriverApp === false) return <span className="text-gray-400" title="Entered by the office, so there's nothing to check">—</span>;
  const checked = !!e.reviewedAt;
  const who = checked ? `Checked${e.checkedBy ? ` by ${e.checkedBy.fullName}` : ""} on ${new Date(e.reviewedAt!).toLocaleDateString()}` : "";
  if (!canManage) {
    return checked ? (
      <span className="inline-flex items-center gap-1 text-teal-700" title={who}>
        <FiCheck size={14} /> Checked
      </span>
    ) : (
      <span className="text-gray-400">Not yet</span>
    );
  }
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={busy}
      title={checked ? `${who}. Click to undo.` : "Tick once you've checked this against the receipt"}
      aria-pressed={checked}
      className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 font-medium transition-colors disabled:opacity-50 ${
        checked ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100" : "border-gray-300 bg-white text-gray-600 hover:border-teal-400 hover:text-teal-700"
      }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded-sm border ${checked ? "border-teal-600 bg-teal-600 text-white" : "border-gray-400"}`}>
        {checked && <FiCheck size={12} />}
      </span>
      {checked ? "Checked" : "Mark checked"}
    </button>
  );
}

// Add an expense, or edit one. Vehicle, type and amount are required; the
// date is today unless changed (never in the future).
function ExpenseForm({
  expense,
  vehicles,
  drivers,
  onClose,
  onSaved,
}: {
  expense: ExpenseRecord | null;
  vehicles: VehicleRecord[];
  drivers: DriverRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = dayOf(new Date());
  const originalDay = expense ? dayOf(new Date(expense.incurredAt)) : today;
  const [vehicleId, setVehicleId] = useState(expense ? idOf(expense.vehicleId) : "");
  const [category, setCategory] = useState<Category | "">(expense?.category ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [day, setDay] = useState(originalDay);
  const [driverId, setDriverId] = useState(expense ? idOf(expense.driverId) : "");
  const driverTouched = useRef(!!expense);
  const [note, setNote] = useState(expense?.note ?? "");
  const [receipt, setReceipt] = useState<{ id: string | null; url: string | null }>({
    id: expense?.receiptUploadId ?? null,
    url: expense?.receiptUrl ? API_URL + expense.receiptUrl : null,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close with Escape.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  function pickVehicle(id: string) {
    setVehicleId(id);
    // Suggest the vehicle's driver, until someone picks one themselves.
    if (!driverTouched.current) {
      const v = vehicles.find((x) => x._id === id);
      const assigned = v?.driverId && typeof v.driverId === "object" ? v.driverId._id : "";
      setDriverId(drivers.some((d) => d._id === assigned) ? assigned : "");
    }
  }

  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setProblem(null);
    try {
      const id = await uploadImage(file, "receipt");
      setReceipt({ id, url: URL.createObjectURL(file) });
    } catch (err) {
      setProblem(errorMessage(err, "Couldn't upload the photo"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setProblem(null);
    const kes = Number(amount.replace(/,/g, "").trim());
    if (!vehicleId) return setProblem("Pick the vehicle this expense is for.");
    if (!category) return setProblem("Pick the type of expense.");
    if (!amount.trim() || !Number.isFinite(kes) || kes <= 0) return setProblem("Enter the amount in KES, for example 2500.");
    if (!day) return setProblem("Pick the date.");
    if (day > today) return setProblem("The date can't be in the future.");

    const body: Record<string, unknown> = {
      vehicleId,
      category,
      amount: kes,
      note: note.trim() || null,
      driverId: driverId || null,
      receiptUploadId: receipt.id,
    };
    // Today: right now. Another day: midday that day. Editing without
    // changing the date keeps the original time.
    if (!expense || day !== originalDay) body.incurredAt = day === today ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();

    setSaving(true);
    try {
      await apiRequest(expense ? `/api/expenses/${expense._id}` : "/api/expenses", {
        method: expense ? "PATCH" : "POST",
        body: JSON.stringify(body),
        notifyErrors: false,
        successMessage: expense ? "Expense saved." : "Expense added.",
      });
      onSaved();
    } catch (err) {
      setProblem(errorMessage(err, "Couldn't save the expense"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet as="form" onSubmit={save} onClose={saving ? undefined : onClose} size="lg" labelledBy="expense-form-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="expense-form-title" className="text-base font-semibold text-gray-900">
              {expense ? "Edit expense" : "Add an expense"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {expense?.fromDriverApp !== false && expense
                ? "Logged by a driver from the app. Your changes are saved for everyone."
                : "For costs paid by the office, or ones a driver forgot to log."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <FiX size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ef-vehicle">Vehicle</label>
            <select id="ef-vehicle" value={vehicleId} onChange={(e) => pickVehicle(e.target.value)} className={inputClass} required>
              <option value="">Pick a vehicle…</option>
              {vehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.plateNumber}
                  {v.make || v.model ? ` (${[v.make, v.model].filter(Boolean).join(" ")})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <span className={labelClass}>Type</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type of expense">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c ? "border-teal-600 bg-teal-600 text-white" : "border-gray-300 text-gray-600 hover:border-teal-400"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ef-amount">Amount (KES)</label>
            <input
              id="ef-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 2500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="ef-date">Date</label>
            <input id="ef-date" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className={inputClass} required />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ef-driver">
              Driver <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <select
              id="ef-driver"
              value={driverId}
              onChange={(e) => {
                driverTouched.current = true;
                setDriverId(e.target.value);
              }}
              className={inputClass}
            >
              <option value="">No driver</option>
              {drivers.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ef-note">
              Note <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="ef-note"
              rows={2}
              maxLength={1000}
              placeholder="e.g. Brake pads at Kariuki Motors"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <span className={labelClass}>
              Receipt photo <span className="font-normal text-gray-400">(optional)</span>
            </span>
            <div className="flex items-center gap-3">
              {receipt.url && (
                <a href={receipt.url} target="_blank" rel="noreferrer" title="Open receipt photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local preview or a signed API image */}
                  <img src={receipt.url} alt="Receipt" className="h-14 w-14 rounded object-cover ring-1 ring-black/10" />
                </a>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
              >
                {uploading ? "Uploading…" : receipt.id ? "Change photo" : "Add photo"}
              </button>
              {receipt.id && !uploading && (
                <button type="button" onClick={() => setReceipt({ id: null, url: null })} className="text-xs text-gray-400 hover:text-red-600">
                  Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickReceipt(e.target.files?.[0])} />
          </div>
        </div>

        {problem && (
          <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {problem}
          </p>
        )}

        <div className={SHEET_ACTIONS}>
          <button type="button" onClick={onClose} disabled={saving} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : expense ? "Save changes" : "Add expense"}
          </button>
        </div>
    </ModalSheet>
  );
}
