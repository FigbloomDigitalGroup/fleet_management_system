"use client";

import { useState } from "react";
import Link from "next/link";
import { FiX } from "react-icons/fi";
import { SPECIAL_OFFER, offerLabel } from "../lib/pricing";

// The current special offer, on the owner's Overview only, below the
// Getting started checklist. Never shown to fleet admins (they can't pay),
// to a fleet already on the offered plan (or above it), to a fleet with no
// vehicles yet (first run), or after the owner closes it (remembered per
// person in this browser).

const HIGHER_OR_SAME: Record<string, string[]> = { pro: ["pro", "enterprise"], basic: ["basic", "pro", "enterprise"] };

export function shouldShowOffer({ isOwner, plan, vehicleCount }: { isOwner: boolean; plan: string | null; vehicleCount: number }) {
  if (!SPECIAL_OFFER.active || !isOwner || !plan || vehicleCount === 0) return false;
  return !(HIGHER_OR_SAME[SPECIAL_OFFER.plan] ?? [SPECIAL_OFFER.plan]).includes(plan);
}

function storageKey(userId: string) {
  return `fleet:offer-dismissed:${SPECIAL_OFFER.plan}-${SPECIAL_OFFER.discountPercent}:${userId}`;
}

function readDismissed(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export default function UpgradeOffer({ userId }: { userId: string }) {
  const key = storageKey(userId);
  const [dismissed, setDismissed] = useState(() => readDismissed(key));
  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // storage blocked: hidden for this visit only
    }
    setDismissed(true);
  }

  return (
    <aside className="mb-4 flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-black/5" aria-label="Special offer">
      <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
        Offer
      </span>
      <p className="min-w-0 flex-1 text-sm text-gray-700">{offerLabel()}</p>
      <Link href="/company/billing" className="shrink-0 text-xs font-semibold text-teal-700 hover:underline">
        See plans
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide this offer"
        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <FiX size={14} />
      </button>
    </aside>
  );
}
