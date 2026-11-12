"use client";

import { useState } from "react";
import { FiBookOpen, FiExternalLink } from "react-icons/fi";
import { apiRequest, errorMessage } from "../lib/api";
import { useHrStatus } from "../lib/hrStatus";
import { usePageHeader } from "./DashboardShell";

// HR & Payroll (owner, full admins, accountants): one click into Figbloom
// HR, signed in as yourself. Fleet asks the platform for a one-time link
// (valid a minute) and opens it; HR decides what you can do there.
export default function HrHandoff() {
  const hr = useHrStatus();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageHeader("HR & Payroll", "Your people's records, leave and payroll, in Figbloom HR");

  async function open() {
    setError(null);
    setOpening(true);
    try {
      const { url } = await apiRequest<{ url: string }>("/api/hr/handoff", {
        method: "POST",
        body: JSON.stringify({}),
        successMessage: false,
        notifyErrors: false,
      });
      window.location.assign(url);
    } catch (err) {
      setError(errorMessage(err, "Couldn't open Figbloom HR. Try again."));
      setOpening(false);
    }
  }

  return (
    <div className="max-w-xl rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <FiBookOpen size={18} aria-hidden />
      </span>
      <h2 className="mt-3 text-base font-semibold text-gray-900">Figbloom HR</h2>
      <p className="mt-1 text-sm text-gray-600">
        Your drivers and team are in Figbloom HR as employees. Approve their records, run payroll, and manage leave there. Leave
        approved in HR shows here: dispatch warns you before giving a job to someone who is away.
      </p>
      {hr.canOpenHr ? (
        <button
          type="button"
          onClick={open}
          disabled={opening}
          className="mt-5 inline-flex items-center gap-2 rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {opening ? "Opening…" : "Open HR & Payroll"} <FiExternalLink size={14} aria-hidden />
        </button>
      ) : (
        <p className="mt-5 text-sm text-gray-500">HR & Payroll isn&apos;t available for your account.</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
