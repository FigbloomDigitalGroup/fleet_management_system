import { User } from "../types/auth";

// Support view: Figbloom staff looking at one customer fleet read-only (the
// API side is backend/lib/supportSession.js). While it lasts, the normal
// session keys hold the short-lived support token and a user acting as the
// fleet's owner, and the staff member's own session waits under
// STAFF_SESSION_KEY until they exit (or the support token runs out).

export const STAFF_SESSION_KEY = "staffSession";
export const SUPPORT_VIEW_ENDED_EVENT = "fleet:support-view-ended";
export const SUPPORT_READ_ONLY_MESSAGE =
  "This is a read-only support view. Figbloom staff can look at a customer's fleet but can't change it.";

interface StoredStaffSession {
  accessToken: string;
  refreshToken: string | null;
  user: User;
}

export function inSupportView(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!localStorage.getItem(STAFF_SESSION_KEY);
  } catch {
    return false;
  }
}

// Keeps the staff member's own session aside and switches to the support token.
export function enterSupportSession(token: string, supportUser: User) {
  const staff: StoredStaffSession = {
    accessToken: localStorage.getItem("accessToken") || "",
    refreshToken: localStorage.getItem("refreshToken"),
    user: JSON.parse(localStorage.getItem("user") || "null"),
  };
  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(staff));
  localStorage.setItem("accessToken", token);
  // A support view is never refreshed: when its hour is up it ends.
  localStorage.removeItem("refreshToken");
  localStorage.setItem("user", JSON.stringify(supportUser));
}

// Puts the staff member's own session back; their user, or null when there
// was none stored.
export function restoreStaffSession(): User | null {
  const raw = localStorage.getItem(STAFF_SESSION_KEY);
  localStorage.removeItem(STAFF_SESSION_KEY);
  if (!raw) return null;
  try {
    const staff: StoredStaffSession = JSON.parse(raw);
    if (!staff?.accessToken || !staff.user) return null;
    localStorage.setItem("accessToken", staff.accessToken);
    if (staff.refreshToken) localStorage.setItem("refreshToken", staff.refreshToken);
    else localStorage.removeItem("refreshToken");
    localStorage.setItem("user", JSON.stringify(staff.user));
    return staff.user;
  } catch {
    return null;
  }
}

// The API said the support view is over (expired or ended elsewhere): back
// to the staff session, and AuthContext takes the person back to /platform.
export function supportViewExpired(companyId?: string) {
  const staff = restoreStaffSession();
  window.dispatchEvent(new CustomEvent(SUPPORT_VIEW_ENDED_EVENT, { detail: { staff, companyId } }));
}
