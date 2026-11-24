"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { apiRequest } from "./api";
import { useAuth } from "../context/AuthContext";
import type { HrConnection } from "./hrLaunch";

export type { HrConnection } from "./hrLaunch";
export { hrOpensDirectly } from "./hrLaunch";

// What Figbloom HR offers the signed-in person (GET /api/hr/status): the
// HR & Payroll item (owner, full admins, accountants) and My HR (everyone in
// a company). Both stay hidden while HR isn't switched on. Asked once per
// person per page load, and again after refreshHrStatus() (the HR & Payroll
// card's "Check again", or after asking Figbloom for HR).

export interface HrStatus {
  enabled: boolean;
  canOpenHr: boolean;
  hasMyHr: boolean;
  canRequestHr: boolean;
  connection: HrConnection | null;
  // when the company asked Figbloom for HR (ISO), if it has
  requestedAt: string | null;
}

export type HrStatusAnswer = HrStatus & {
  // false until the first answer for the person signed in now
  loaded: boolean;
};

const OFF: HrStatus = { enabled: false, canOpenHr: false, hasMyHr: false, canRequestHr: false, connection: null, requestedAt: null };
const cache = new Map<string, Promise<HrStatus>>();

// Bumped by refreshHrStatus(): every mounted useHrStatus asks again.
let version = 0;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function refreshHrStatus() {
  cache.clear();
  version++;
  listeners.forEach((l) => l());
}

export function useHrStatus(): HrStatusAnswer {
  const { user } = useAuth();
  const key = user && !user.support && user.companyId ? `${user.id}:${user.companyId}:${user.role}:${user.adminAccess ?? ""}` : null;
  const asked = useSyncExternalStore(subscribe, () => version, () => 0);
  const [answer, setAnswer] = useState<{ key: string; status: HrStatus } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    if (!cache.has(key)) {
      cache.set(
        key,
        apiRequest<HrStatus>("/api/hr/status", { notifyErrors: false }).then(
          (s) => ({ ...OFF, ...s }),
          () => {
            cache.delete(key);
            return OFF;
          }
        )
      );
    }
    cache.get(key)!.then((status) => {
      if (!cancelled) setAnswer({ key, status });
    });
    return () => {
      cancelled = true;
    };
  }, [key, asked]);

  // only the answer for the person signed in now
  if (!key) return { ...OFF, loaded: true };
  return answer?.key === key ? { ...answer.status, loaded: true } : { ...OFF, loaded: false };
}
