"use client";

import Link from "next/link";
import { SUPPORT_EMAIL } from "../lib/support";

// What a new company owner sees right after registering, worded for what
// will really happen:
// - "auto": the fleet is active and they're already signed in;
// - "console": the Figbloom console decides, usually automatically within a
//   minute or two (this page notices and switches to "You're all set");
// - "manual": a person at Figbloom approves it, usually within a working day.

export type Approval = "console" | "manual" | "auto";

const NEXT_STEPS = [
  { title: "Sign in", text: "You land on your Overview, with a Getting started checklist." },
  { title: "Add your vehicles and drivers", text: "You do it yourself, straight away. No admin needed." },
  {
    title: "Connect tracking",
    text: "On each vehicle's page: connect a GPS tracker, or (once the driver app is out) the driver's phone. Vehicles then show on the live map.",
  },
  { title: "Invite help if you want it", text: "Optional: give a fleet admin their own login. You can also run everything yourself." },
];

export default function RegistrationDone({
  companyName,
  email,
  status,
  approval,
  supportEmail,
  onOpenDashboard,
}: {
  companyName: string;
  email: string;
  status: "active" | "pending";
  approval: Approval;
  supportEmail?: string;
  onOpenDashboard: () => void;
}) {
  const active = status === "active";
  const support = supportEmail || SUPPORT_EMAIL;

  return (
    <div className="w-full max-w-sm" role="status" aria-live="polite">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      {active ? (
        <>
          <h2 className="text-3xl font-extrabold text-teal-950 mb-3">You&apos;re all set</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-800">{companyName}</span> is active and ready to use. We&apos;ve also
            sent a welcome email to <span className="font-semibold text-gray-800">{email}</span>.
          </p>
          <button
            type="button"
            onClick={onOpenDashboard}
            className="mt-6 w-full py-2.5 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600"
          >
            Open your fleet
          </button>
        </>
      ) : approval === "manual" ? (
        <>
          <h2 className="text-3xl font-extrabold text-teal-950 mb-3">Waiting for approval</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Thanks for registering <span className="font-semibold text-gray-800">{companyName}</span>. A person at Figbloom
            checks every new fleet before it&apos;s switched on. That usually happens within one working day (Monday to
            Friday).
          </p>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            We&apos;ll email <span className="font-semibold text-gray-800">{email}</span> when it&apos;s approved. Until then,
            signing in shows your fleet&apos;s status. If it&apos;s approved while this page is open, the page updates by
            itself.
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" aria-hidden="true" />
            Waiting for a Figbloom reviewer
          </p>
        </>
      ) : (
        <>
          <h2 className="text-3xl font-extrabold text-teal-950 mb-3">Your fleet is being set up</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Thanks for registering <span className="font-semibold text-gray-800">{companyName}</span>. Most fleets are
            switched on automatically within a minute or two; if yours is picked for a manual check it can take up to one
            working day.
          </p>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            Keep this page open and it will switch to &quot;You&apos;re all set&quot; by itself. We&apos;ll also email{" "}
            <span className="font-semibold text-gray-800">{email}</span>.
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" aria-hidden="true" />
            Switching your fleet on…
          </p>
        </>
      )}

      {!active && (
        <p className="mt-4 text-xs text-gray-500">
          Questions? Email{" "}
          <a href={`mailto:${support}`} className="font-medium text-teal-700 hover:underline">
            {support}
          </a>
          .
        </p>
      )}

      <div className="mt-8 border-t border-gray-100 pt-6">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">What happens next</p>
        <ol className="space-y-3">
          {NEXT_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-gray-800">{step.title}</span>
                <span className="block text-xs text-gray-500">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <Link href="/" className="mt-6 inline-block text-sm text-gray-500 hover:text-teal-700">
        Back to home
      </Link>
    </div>
  );
}
