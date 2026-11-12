"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import { useAuth } from "../context/AuthContext";

// What Figbloom HR offers the signed-in person (GET /api/hr/status): the
// HR & Payroll item (owner, full admins, accountants) and My HR (everyone in
// a company). Both stay hidden while HR isn't switched on. Asked once per
// person per page load.
export interface HrStatus {
  enabled: boolean;
  canOpenHr: boolean;
  hasMyHr: boolean;
}

const OFF: HrStatus = { enabled: false, canOpenHr: false, hasMyHr: false };
const cache = new Map<string, Promise<HrStatus>>();

export function useHrStatus(): HrStatus {
  const { user } = useAuth();
  const key = user && !user.support && user.companyId ? `${user.id}:${user.role}:${user.adminAccess ?? ""}` : null;
  const [answer, setAnswer] = useState<{ key: string; status: HrStatus } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    if (!cache.has(key)) {
      cache.set(
        key,
        apiRequest<HrStatus>("/api/hr/status", { notifyErrors: false }).catch(() => {
          cache.delete(key);
          return OFF;
        })
      );
    }
    cache.get(key)!.then((status) => {
      if (!cancelled) setAnswer({ key, status });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // only the answer for the person signed in now
  return key && answer?.key === key ? answer.status : OFF;
}
