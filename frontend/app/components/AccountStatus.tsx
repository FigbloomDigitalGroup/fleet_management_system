"use client";

import { FiClock, FiPauseCircle, FiXCircle, FiAlertCircle } from "react-icons/fi";
import { SUPPORT_EMAIL } from "../lib/support";

// What a company owner (or admin) sees when signing in to a fleet that can't
// be used yet or any more, instead of a short error popup: what state the
// fleet is in, what happens next, and who to contact.

export type AccountStatusCode = "company_pending" | "company_suspended" | "company_rejected" | "trial_ended";

export interface AccountStatusInfo {
  code: AccountStatusCode;
  companyName?: string;
  registeredAt?: string;
  approval?: "console" | "manual" | "auto";
  supportEmail?: string;
}

export function isAccountStatusCode(code: unknown): code is AccountStatusCode {
  return code === "company_pending" || code === "company_suspended" || code === "company_rejected" || code === "trial_ended";
}

function since(iso?: string) {
  if (!iso) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function AccountStatus({
  info,
  email,
  onRetry,
  retrying,
  onBack,
}: {
  info: AccountStatusInfo;
  email: string;
  onRetry: () => void;
  retrying: boolean;
  onBack: () => void;
}) {
  const fleet = info.companyName || "Your fleet";
  const support = info.supportEmail || SUPPORT_EMAIL;
  const registered = since(info.registeredAt);
  const manual = info.approval === "manual";

  const content = {
    company_pending: {
      icon: FiClock,
      tone: "bg-orange-50 text-orange-600",
      title: manual ? "Your fleet is waiting for approval" : "Your fleet is being set up",
      body: manual
        ? `${fleet} was registered${registered ? ` ${registered}` : ""}. A person at Figbloom checks every new fleet before it's switched on, usually within one working day.`
        : `${fleet} was registered${registered ? ` ${registered}` : ""}. Most fleets are switched on automatically within a few minutes; if yours is picked for a manual check it can take up to one working day.`,
      next: [
        `We'll email ${email || "you"} as soon as ${fleet} is switched on.`,
        "Then sign in here with the same email and password. You'll land on your Overview with a Getting started checklist.",
        "First steps: add your vehicles and drivers, then connect each vehicle's tracker so it shows on the live map.",
      ],
    },
    company_suspended: {
      icon: FiPauseCircle,
      tone: "bg-gray-100 text-gray-600",
      title: "This fleet's account is paused",
      body: `${fleet} has been suspended, so nobody can sign in to it for now. Your vehicles, trips and settings are kept.`,
      next: [`Email ${support} and we'll tell you why and what's needed to switch it back on.`],
    },
    company_rejected: {
      icon: FiXCircle,
      tone: "bg-red-50 text-red-600",
      title: "This registration wasn't approved",
      body: `${fleet} wasn't switched on after review.`,
      next: [`If you think that's a mistake, email ${support} and we'll take another look.`],
    },
    trial_ended: {
      icon: FiAlertCircle,
      tone: "bg-orange-50 text-orange-600",
      title: "Your free trial has ended",
      body: `The free trial for ${fleet} is over. Everything you set up is kept.`,
      next: [`Email ${support} to choose a plan, and we'll switch your fleet back on.`],
    },
  }[info.code];
  const Icon = content.icon;

  return (
    <div className="w-full max-w-sm" role="status" aria-live="polite">
      <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full ${content.tone}`}>
        <Icon size={26} aria-hidden="true" />
      </div>
      <h2 className="mb-3 text-3xl font-extrabold text-teal-950">{content.title}</h2>
      <p className="text-sm leading-relaxed text-gray-600">{content.body}</p>

      <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-gray-500">What happens next</p>
      <ul className="space-y-2">
        {content.next.map((line) => (
          <li key={line} className="flex gap-2 text-sm text-gray-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-2">
        {info.code === "company_pending" && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="w-full rounded bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {retrying ? "Checking…" : "Check again"}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded border border-teal-600 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50"
        >
          Back to sign in
        </button>
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Questions? Email{" "}
        <a href={`mailto:${support}?subject=${encodeURIComponent(`${fleet}: account status`)}`} className="font-medium text-teal-700 hover:underline">
          {support}
        </a>
        .
      </p>
    </div>
  );
}
