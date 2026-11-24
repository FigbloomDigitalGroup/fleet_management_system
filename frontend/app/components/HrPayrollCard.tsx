"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiBookOpen, FiCheck, FiExternalLink, FiLoader, FiRefreshCw } from "react-icons/fi";
import { apiRequest, errorMessage, type ApiError } from "../lib/api";
import { HrConnection, hrOpensDirectly, refreshHrStatus, useHrStatus } from "../lib/hrStatus";
import { openHrLaunchTab } from "../lib/hrLaunch";
import { useAuth } from "../context/AuthContext";
import { useAppShell } from "./AppShell";
import { usePageHeader } from "./DashboardShell";
import Skeleton from "./Skeleton";

// HR & Payroll (owner, full admins, accountants): Figbloom HR for the
// company. When it's there, one click opens it in a new tab, signed in as
// yourself (/hr/launch). While it's being set up, say so; when it isn't
// there, the company can ask Figbloom for it (staff switch it on in the
// console).

type CardState = "connected" | "setting_up" | "not_connected" | "requested";

function cardState(connection: HrConnection | null, requestedAt: string | null): CardState {
  if (hrOpensDirectly(connection)) return "connected";
  if (connection === "setting_up") return "setting_up";
  return requestedAt ? "requested" : "not_connected";
}

const PILLS: Record<CardState, { text: string; className: string } | null> = {
  connected: { text: "Connected", className: "border-green-200 bg-green-50 text-green-700" },
  setting_up: { text: "Setting up", className: "border-amber-200 bg-amber-50 text-amber-800" },
  not_connected: { text: "Not connected", className: "border-gray-200 bg-gray-50 text-gray-600" },
  requested: { text: "Requested", className: "border-blue-200 bg-blue-50 text-blue-700" },
};

const PRIMARY =
  "inline-flex items-center gap-2 rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export default function HrPayrollCard() {
  const hr = useHrStatus();
  const { user } = useAuth();
  const shell = useAppShell();
  const router = useRouter();
  const companyName = shell?.companyName ?? user?.companyName ?? "your company";
  const [requesting, setRequesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageHeader("HR & Payroll", "Payroll, payslips, leave and attendance for your team, in Figbloom HR");

  if (!hr.loaded) {
    return (
      <div className="max-w-xl rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5" aria-busy="true" aria-label="Loading HR & Payroll">
        <div className="flex items-center gap-3">
          <div className="skeleton-shimmer h-10 w-10 rounded-full" />
          <div className="skeleton-shimmer h-5 w-48 rounded" />
        </div>
        <Skeleton rows={2} rowClassName="h-4" className="mt-4" />
        <div className="skeleton-shimmer mt-5 h-9 w-44 rounded" />
      </div>
    );
  }

  if (!hr.canOpenHr) {
    return (
      <div className="max-w-xl rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
        <Header />
        <p className="mt-3 text-sm text-gray-500">HR &amp; Payroll isn&apos;t available for your account.</p>
      </div>
    );
  }

  const state = cardState(hr.connection, hr.requestedAt);

  async function request() {
    setError(null);
    setRequesting(true);
    try {
      await apiRequest<{ requestedAt: string }>("/api/hr/request", {
        method: "POST",
        body: JSON.stringify({}),
        successMessage: false,
        notifyErrors: false,
      });
      refreshHrStatus();
    } catch (err) {
      if ((err as ApiError).data?.code === "already_connected") refreshHrStatus();
      setError(errorMessage(err, "Couldn't send the request. Try again."));
    } finally {
      setRequesting(false);
    }
  }

  function checkAgain() {
    setChecking(true);
    refreshHrStatus();
    // the card follows the new answer; the spinner is only a short sign it was asked
    window.setTimeout(() => setChecking(false), 800);
  }

  return (
    <div className="max-w-xl rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
      {/* couldn't be checked: offered like connected, without claiming it is */}
      <Header state={hr.connection === "unknown" ? undefined : state} />

      {state === "connected" && (
        <>
          <p className="mt-3 text-sm text-gray-600">Payroll, payslips, leave and attendance for your team.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => openHrLaunchTab(router.push)} className={PRIMARY}>
              Open Figbloom HR <FiExternalLink size={14} aria-hidden />
            </button>
            <span className="text-xs text-gray-500">Opens in a new tab</span>
          </div>
        </>
      )}

      {state === "setting_up" && (
        <>
          <p className="mt-3 text-sm text-gray-600">
            Figbloom HR is being set up for {companyName}. The owner will receive an email invitation.
          </p>
          <button type="button" onClick={checkAgain} disabled={checking} className={`mt-5 ${SECONDARY}`}>
            <FiRefreshCw size={14} aria-hidden className={checking ? "animate-spin" : undefined} />
            Check again
          </button>
        </>
      )}

      {(state === "not_connected" || state === "requested") && (
        <>
          <p className="mt-3 text-sm text-gray-600">
            Run your team&apos;s HR and payroll in Figbloom HR, connected to Fleet.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
            {["Run payroll and payslips", "Leave and attendance", "Staff from Fleet added automatically", "Billed separately as an add-on"].map(
              (point) => (
                <li key={point} className="flex items-start gap-2">
                  <FiCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-teal-600" />
                  {point}
                </li>
              )
            )}
          </ul>
          {state === "requested" ? (
            <>
              <p className="mt-4 text-sm text-gray-600">
                Requested on {formatDate(hr.requestedAt!)}. Our team will contact you to set it up.
              </p>
              <button type="button" disabled className={`mt-4 ${PRIMARY}`}>
                <FiCheck size={14} aria-hidden /> Request sent
              </button>
            </>
          ) : (
            <button type="button" onClick={request} disabled={requesting || !hr.canRequestHr} className={`mt-5 ${PRIMARY}`}>
              {requesting && <FiLoader size={14} aria-hidden className="animate-spin" />}
              {requesting ? "Sending request…" : "Request Figbloom HR"}
            </button>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function Header({ state }: { state?: CardState }) {
  const pill = state ? PILLS[state] : null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <FiBookOpen size={18} aria-hidden />
      </span>
      <h2 className="text-base font-semibold text-gray-900">Figbloom HR &amp; Payroll</h2>
      {pill && (
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${pill.className}`}>
          <span className="sr-only">Status: </span>
          {pill.text}
        </span>
      )}
    </div>
  );
}
