"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { INDUSTRIES } from "../lib/industries";
import { defaultFleetName } from "../lib/fleetName";
import { errorMessage } from "../lib/api";
import { notifySuccess } from "../lib/notify";

const INPUT = "w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";

// The company setup form for someone already signed in (an owner, a team
// member, a driver or Figbloom staff): the same fleet name and industry as
// on Register, with their own account filled in and no password step. The
// new company is theirs (owner) and goes through the usual approval; once
// it's switched on they're taken into it.
export default function CreateFleetForm({
  initialName,
  initialIndustry,
  onCancel,
  onDone,
  onSwitched,
}: {
  initialName?: string;
  initialIndustry?: string;
  onCancel?: () => void;
  // after "OK" on the "waiting for approval" message
  onDone?: () => void;
  // switched straight into the new (active) fleet
  onSwitched?: () => void;
}) {
  const { user, createFleet } = useAuth();
  const router = useRouter();
  const [companyName, setCompanyName] = useState(initialName ?? defaultFleetName(user?.fullName ?? ""));
  const [industry, setIndustry] = useState(initialIndustry ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<{ name: string; approval: string; supportEmail?: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Give your new fleet a name (your own name is fine).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createFleet({ companyName: companyName.trim(), industry: industry || undefined });
      if (result.switched) {
        notifySuccess(`You're now in ${result.company.name}, as its owner.`, "New fleet ready");
        router.push("/company/dashboard");
        onSwitched?.();
        return;
      }
      setWaiting({ name: result.company.name, approval: result.approval, supportEmail: result.supportEmail });
    } catch (err) {
      setError(errorMessage(err, "We couldn't create the fleet. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (waiting) {
    return (
      <div className="space-y-3 text-sm text-gray-700">
        <p className="font-medium text-gray-900">{waiting.name} has been created.</p>
        <p>
          {waiting.approval === "manual"
            ? "The Figbloom team checks every new fleet before it's switched on, usually within one working day."
            : "It's being checked by Figbloom now. That usually takes a minute or two."}{" "}
          You can keep working where you are: we&apos;ll take you into {waiting.name} as soon as it&apos;s switched on, and email you too.
        </p>
        {waiting.supportEmail && (
          <p className="text-xs text-gray-500">
            Questions? Write to <a className="text-teal-700 underline" href={`mailto:${waiting.supportEmail}`}>{waiting.supportEmail}</a>.
          </p>
        )}
        <button type="button" onClick={onDone} className="w-full rounded bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600">
          OK
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <span className="block font-medium text-gray-800">You will be the owner</span>
        {user?.fullName ? `${user.fullName} · ` : ""}
        {user?.email}
        <span className="mt-1 block">No new password needed: you use the account you&apos;re signed in with.</span>
      </div>
      <div>
        <label htmlFor="new-fleet-name" className="mb-1 block text-xs font-medium text-gray-600">
          Fleet name
        </label>
        <input id="new-fleet-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={120} className={INPUT} />
      </div>
      <div>
        <label htmlFor="new-fleet-industry" className="mb-1 block text-xs font-medium text-gray-600">
          What kind of work? <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <select id="new-fleet-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className={INPUT}>
          <option value="">Choose one</option>
          {INDUSTRIES.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-gray-500">
        Your other fleets stay as they are. You can move between them with the fleet menu at the top of the page.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 rounded border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
        )}
        <button type="submit" disabled={busy} className="flex-1 rounded bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60">
          {busy ? "Creating…" : "Create fleet"}
        </button>
      </div>
    </form>
  );
}
