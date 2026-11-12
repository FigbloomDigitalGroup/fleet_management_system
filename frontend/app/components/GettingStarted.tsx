"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiCheck, FiX } from "react-icons/fi";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useAdminAccess } from "../lib/adminAccess";
import { AdminRecord, CompanyRecord, DriverRecord, GeofenceRecord, LiveVehicleRecord, VehicleRecord } from "../types/auth";

// The first-run "Getting started" checklist on the company owner's and fleet
// admin's Overview. Every tick comes from real data (nothing is ticked by
// hand), so it stays right however the step was done. Dismissing it is
// remembered per person in this browser; the Help page can bring it back.

const REFRESH_MS = 30000;

export function gettingStartedStorageKey(userId: string) {
  return `fleet:getting-started-dismissed:${userId}`;
}

function readDismissed(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

interface Progress {
  vehicles: number;
  drivers: number;
  admins: number;
  tracked: number;
  geofences: number;
  billingSet: boolean;
  // The first vehicle that isn't reporting yet, for "Connect tracking".
  unconnected: { id: string; plate: string } | null;
}

interface Step {
  key: string;
  title: string;
  text: string;
  done: boolean;
  optional?: boolean;
  action: { label: string; href: string };
}

// The same first steps for a company owner and a full fleet admin: owners
// manage their own fleet directly, so nobody has to invite an admin first.
// Owners also get two optional extras: inviting admins (to share the work)
// and billing.
function fleetSteps(p: Progress, base: "/company" | "/admin"): Step[] {
  return [
    {
      key: "vehicle",
      title: "Add your first vehicle",
      text: "Enter the plate number; make, model and tracker ID are optional.",
      done: p.vehicles > 0,
      action: { label: "Add a vehicle", href: `${base}/vehicles#add-vehicle` },
    },
    {
      key: "driver",
      title: "Add a driver and assign a vehicle",
      text: "This creates their login for the phone app. Assign their vehicle from the Drivers or Vehicles list.",
      done: p.drivers > 0,
      action: { label: "Add a driver", href: `${base}/drivers#add-driver` },
    },
    {
      key: "tracking",
      title: "Connect tracking",
      text: "Connect a GPS tracker (or, once the driver app is out, the driver's phone) on the vehicle's page. It then shows on the live map.",
      done: p.tracked > 0,
      action: p.unconnected
        ? { label: `Connect ${p.unconnected.plate}`, href: `${base}/vehicles/${p.unconnected.id}#connect-tracking` }
        : { label: "How it works", href: "/help#tracking" },
    },
    {
      key: "geofence",
      title: "Draw your depot geofence",
      text: "Get an alert whenever a vehicle leaves or comes back to your yard.",
      done: p.geofences > 0,
      action: { label: "Draw a zone", href: `${base}/geofences#add-zone` },
    },
  ];
}

function ownerSteps(p: Progress): Step[] {
  return [
    ...fleetSteps(p, "/company"),
    {
      key: "admin",
      title: "Invite a fleet admin",
      text: "Want someone else to help run the fleet? Give them their own login. You can keep doing everything yourself.",
      done: p.admins > 0,
      optional: true,
      action: { label: "Add an admin", href: "/company/admins#add-admin" },
    },
    {
      key: "billing",
      title: "Set up billing",
      text: "Choose a plan and pay by M-Pesa or card when you're ready.",
      done: p.billingSet,
      optional: true,
      action: { label: "View plans", href: "/company/billing" },
    },
  ];
}

function adminSteps(p: Progress): Step[] {
  return fleetSteps(p, "/admin");
}

export default function GettingStarted() {
  const { user } = useAuth();
  const { canManageFleet } = useAdminAccess();
  const isOwner = user?.role === "COMPANY_OWNER";
  // Restricted admins can't do these steps, so they don't get the list.
  // Nor do Figbloom staff looking on in a read-only support view.
  const eligible = !!user && !user.support && (isOwner || (user.role === "ADMIN" && canManageFleet));
  const storageKey = user ? gettingStartedStorageKey(user.id) : null;

  // Only rendered inside a signed-in area (ProtectedRoute waits for the
  // session), so the key is known on the first client render.
  const [dismissed, setDismissed] = useState(() => (storageKey ? readDismissed(storageKey) : true));
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    if (!eligible || dismissed) return;
    let cancelled = false;
    async function load() {
      // Each count is independent: one failing (e.g. offline for a moment)
      // shouldn't hide the others, so it just counts as not done yet.
      const count = <T,>(path: string, fn: (data: T) => number) =>
        apiRequest<T>(path)
          .then(fn)
          .catch(() => 0);
      let unconnected: Progress["unconnected"] = null;
      const [vehicles, drivers, admins, tracked, geofences, billing] = await Promise.all([
        count<VehicleRecord[]>("/api/vehicles", (d) => d.length),
        count<DriverRecord[]>("/api/users/drivers", (d) => d.length),
        isOwner ? count<AdminRecord[]>("/api/users/admins", (d) => d.length) : Promise.resolve(0),
        count<LiveVehicleRecord[]>("/api/tracking/live", (d) => {
          const first = d.find((v) => !v.lastLocation);
          unconnected = first ? { id: first.vehicleId, plate: first.plateNumber } : null;
          return d.filter((v) => v.lastLocation).length;
        }),
        count<GeofenceRecord[]>("/api/geofences", (d) => d.length),
        isOwner
          ? count<CompanyRecord>("/api/companies/me", (c) => (c.subscriptionPlan !== "trial" || !!c.paymentMethod ? 1 : 0))
          : Promise.resolve(0),
      ]);
      if (!cancelled) setProgress({ vehicles, drivers, admins, tracked, geofences, billingSet: billing > 0, unconnected });
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eligible, dismissed, isOwner]);

  if (!eligible || dismissed || !progress) return null;

  const steps = isOwner ? ownerSteps(progress) : adminSteps(progress);
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const allDone = doneCount === required.length;
  const nextKey = steps.find((s) => !s.done)?.key;

  function dismiss() {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        // storage blocked: hidden for this visit only
      }
    }
    setDismissed(true);
  }

  return (
    <section className="mb-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5" aria-labelledby="getting-started-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="getting-started-title" className="text-base font-semibold text-gray-900">
            {allDone ? "You're set up" : "Getting started"}
          </h2>
          <p className="mt-0.5 text-xs text-teal-600">
            {allDone
              ? "Everything's in place. Your vehicles will appear on the live map as they report in."
              : `${doneCount} of ${required.length} done. Each step ticks itself off once it's done.`}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          <FiX size={14} />
          {allDone ? "Close" : "Hide"}
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
        <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${(doneCount / required.length) * 100}%` }} />
      </div>

      <ol className="mt-4 divide-y divide-gray-100">
        {steps.map((step) => (
          <li key={step.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                step.done ? "border-teal-600 bg-teal-600 text-white" : "border-gray-300 text-transparent"
              }`}
              aria-hidden="true"
            >
              <FiCheck size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${step.done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                {step.title}
                {step.optional && <span className="ml-2 text-[11px] font-normal text-gray-400 no-underline">(optional)</span>}
                <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
              </p>
              {!step.done && <p className="text-xs text-gray-500">{step.text}</p>}
            </div>
            {!step.done && (
              <Link
                href={step.action.href}
                className={`shrink-0 rounded px-3 py-1.5 text-center text-xs font-medium transition-colors ${
                  step.key === nextKey
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "border border-gray-300 text-gray-700 hover:border-teal-400 hover:text-teal-700"
                }`}
              >
                {step.action.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
