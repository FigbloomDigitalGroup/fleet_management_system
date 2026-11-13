import { Membership, User } from "../types/auth";

// The fleets a person belongs to and which one the session runs as
// (FLEET_MEMBERSHIPS_CONTRACT.md). The list is kept next to the stored user
// so the fleet switcher can show it straight away; the API is the truth.

export const MEMBERSHIPS_KEY = "memberships";
// lib/api.ts tells AuthContext when a token refresh moved the session (the
// person was switched off in the fleet they were in, and the API put them in
// another one, or in none).
export const SESSION_CHANGED_EVENT = "fleet:session-changed";
// A new fleet waiting for approval: switched into once it is approved.
export const PENDING_FLEET_KEY = "fleet:pending-new-fleet";

export interface SessionChange {
  user: User;
  memberships: Membership[];
  previousCompanyId: string | null;
}

export function readMemberships(): Membership[] {
  try {
    return JSON.parse(localStorage.getItem(MEMBERSHIPS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function storeMemberships(list: Membership[] | undefined) {
  try {
    if (list) localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(list));
    else localStorage.removeItem(MEMBERSHIPS_KEY);
  } catch {
    // storage unavailable: the switcher loads the list itself
  }
}
