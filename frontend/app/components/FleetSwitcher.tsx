"use client";

import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiPlus, FiShield } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../lib/roleRedirect";
import { PENDING_FLEET_KEY } from "../lib/fleetSession";
import { errorMessage } from "../lib/api";
import { notify } from "../lib/notify";
import CreateFleetForm from "./CreateFleetForm";

const PENDING_CHECK_MS = 60_000;

// The fleet menu in the header (FLEET_MEMBERSHIPS_CONTRACT.md section 2):
// the fleets this person is in, with their role in each, to move between
// them; and "Create a new fleet" for anyone signed in. A small button when
// they only have the one fleet. A new fleet still waiting for approval is
// shown as such, and is switched into once it's approved.
export default function FleetSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { user, memberships, refreshMemberships, switchFleet, backToStaffArea } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // close when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // fresh list when opened
  useEffect(() => {
    if (open) refreshMemberships().catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new fleet waiting for approval: look every minute, and go in once it's on.
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = localStorage.getItem(PENDING_FLEET_KEY);
    } catch {}
    if (!pending) return;
    const timer = setInterval(async () => {
      try {
        const list = await refreshMemberships();
        const fleet = list.find((m) => m.companyId === pending);
        if (!fleet) return;
        if (fleet.companyStatus === "active") {
          clearInterval(timer);
          localStorage.removeItem(PENDING_FLEET_KEY);
          notify({ kind: "success", title: `${fleet.companyName ?? "Your new fleet"} is approved`, message: "Taking you there now." });
          await switchFleet(fleet.companyId);
        } else if (fleet.companyStatus === "rejected") {
          clearInterval(timer);
          localStorage.removeItem(PENDING_FLEET_KEY);
        }
      } catch {
        // offline for a moment: try again on the next tick
      }
    }, PENDING_CHECK_MS);
    return () => clearInterval(timer);
  }, [user?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || user.support) return null;

  const current = memberships.find((m) => m.current) ?? memberships.find((m) => m.companyId === user.companyId);
  const others = memberships.filter((m) => m !== current);
  const inStaffArea = user.role === "PLATFORM_ADMIN";
  const dark = tone === "dark";

  async function go(companyId: string) {
    setBusy(companyId);
    setError(null);
    try {
      await switchFleet(companyId);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't switch fleet. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  async function toStaff() {
    setBusy("staff");
    try {
      await backToStaffArea();
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't go back to the staff area."));
    } finally {
      setBusy(null);
    }
  }

  const several = memberships.length > 1 || (user.isPlatformAdmin && memberships.length > 0);
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={several ? "Switch fleet" : "Your fleets"}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${
          dark ? "border-teal-700 text-teal-100 hover:bg-teal-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {several ? "Switch fleet" : "Fleets"}
        <FiChevronDown size={12} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-1 text-left shadow-lg">
          {current && (
            <div className="flex items-start gap-2 rounded px-3 py-2">
              <FiCheck size={14} className="mt-0.5 shrink-0 text-teal-600" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900">{current.companyName}</span>
                <span className="block text-[11px] text-gray-500">{roleLabel(current.role, current.adminAccess)} · you&apos;re here now</span>
              </span>
            </div>
          )}
          {others.map((m) => {
            const waiting = m.companyStatus === "pending";
            const closed = m.companyStatus === "suspended" || m.companyStatus === "rejected";
            return (
              <button
                key={m.companyId}
                type="button"
                role="menuitem"
                disabled={!!busy || waiting || closed}
                onClick={() => go(m.companyId)}
                className="flex w-full items-start gap-2 rounded px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="w-[14px] shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-900">{m.companyName}</span>
                  <span className="block text-[11px] text-gray-500">
                    {roleLabel(m.role, m.adminAccess)}
                    {waiting ? " · waiting for approval" : closed ? " · not available" : ""}
                  </span>
                </span>
                {!waiting && !closed && (
                  <span className="shrink-0 text-[11px] font-medium text-teal-700">{busy === m.companyId ? "Switching…" : "Switch"}</span>
                )}
              </button>
            );
          })}
          {user.isPlatformAdmin && !inStaffArea && (
            <button
              type="button"
              role="menuitem"
              disabled={!!busy}
              onClick={toStaff}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <FiShield size={14} className="shrink-0 text-amber-600" />
              Figbloom staff area
            </button>
          )}
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <FiPlus size={14} className="shrink-0 text-orange-500" />
            Create a new fleet
          </button>
          {error && <p className="px-3 pb-2 text-[11px] text-red-600">{error}</p>}
        </div>
      )}
      {creating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-gray-900">Create a new fleet</h2>
            <p className="mb-4 mt-1 text-xs text-gray-500">A separate company with its own vehicles, drivers and team, owned by you.</p>
            <CreateFleetForm onCancel={() => setCreating(false)} onDone={() => setCreating(false)} onSwitched={() => setCreating(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
