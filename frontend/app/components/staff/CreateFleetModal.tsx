"use client";

import { FormEvent, useState } from "react";
import { FiCheckCircle, FiX } from "react-icons/fi";
import { apiRequest } from "../../lib/api";
import { INDUSTRIES } from "../../lib/industries";
import { CompanyRecord } from "../../types/auth";
import OpenFleetButton from "./OpenFleetButton";
import ModalSheet from "../ModalSheet";

interface CreateFleetResult {
  message: string;
  company: CompanyRecord;
  owner: { email: string; fullName: string };
  platform: { result?: string; queued?: boolean; configured?: boolean; error?: string };
}

const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";

// Figbloom staff setting up a client: the fleet starts active, and its owner
// gets an email with a link to set their own password (nobody else ever
// knows it). It is registered with the Figbloom console like the demo fleet.
export default function CreateFleetModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (c: CompanyRecord) => void }) {
  const [fleetName, setFleetName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [industry, setIndustry] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateFleetResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiRequest<CreateFleetResult>("/api/support/fleets", {
        method: "POST",
        body: JSON.stringify({ fleetName, ownerName, ownerEmail, industry }),
        successMessage: "Fleet created.",
      });
      setResult(data);
      onCreated?.(data.company);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the fleet");
    } finally {
      setSubmitting(false);
    }
  }

  const platformNote = (() => {
    const p = result?.platform;
    if (!p) return null;
    if (p.result === "registered" || p.result === "decided_on_platform") return "It is registered in the Figbloom console as active.";
    if (p.result === "error") return `It isn't in the Figbloom console yet (${p.error}). Ask an engineer to run the platform backfill.`;
    return "It will appear in the Figbloom console within a minute.";
  })();

  return (
    <ModalSheet>
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900">{result ? "Fleet created" : "Create a fleet for a client"}</h2>
            {!result && (
              <p className="mt-1 text-xs text-gray-500">
                The fleet is active straight away. Its owner gets an email with a link to set their password, then adds
                their vehicles and drivers.
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <FiX size={18} />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 text-sm text-gray-700">
            <p className="flex items-start gap-2">
              <FiCheckCircle className="mt-0.5 shrink-0 text-teal-600" />
              <span>
                <strong>{result.company.name}</strong> is ready. <strong>{result.owner.email}</strong> has been emailed a link to
                set their password (valid 3 days; after that they can use &quot;Forgot password&quot;).
              </span>
            </p>
            {platformNote && <p className="text-xs text-gray-500">{platformNote}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Done
              </button>
              <OpenFleetButton companyId={result.company._id} />
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="cf-fleet">
                Fleet name
              </label>
              <input id="cf-fleet" required maxLength={120} value={fleetName} onChange={(e) => setFleetName(e.target.value)} className={inputClass} placeholder="e.g. Juma Transport" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="cf-owner">
                Owner&apos;s full name
              </label>
              <input id="cf-owner" required maxLength={120} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="cf-email">
                Owner&apos;s email
              </label>
              <input id="cf-email" type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className={inputClass} />
              <p className="mt-1 text-[11px] text-gray-500">Must not already have a Figbloom Fleet account.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="cf-industry">
                Industry
              </label>
              <select id="cf-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass}>
                {INDUSTRIES.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create fleet"}
              </button>
            </div>
          </form>
        )}
    </ModalSheet>
  );
}
