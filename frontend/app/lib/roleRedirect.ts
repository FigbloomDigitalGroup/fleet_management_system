import { AdminAccess, Role } from "../types/auth";

// Every role lands on its own area's dashboard after signing in, and is sent
// back there if it opens a page from another role's area (ProtectedRoute).
export function redirectPathForRole(role: Role | null | undefined): string {
  switch (role) {
    case "PLATFORM_ADMIN":
      return "/platform/dashboard";
    case "COMPANY_OWNER":
      return "/company/dashboard";
    case "ADMIN":
    case "OPERATOR":
    case "ACCOUNTANT":
    case "MECHANIC":
    case "SUPERVISOR":
      // the staff roles use the admin area, with their own menu
      return "/admin/dashboard";
    case "DRIVER":
      return "/driver/dashboard";
    case null:
      // signed in, but in no fleet right now
      return "/no-fleet";
    default:
      return "/";
  }
}

// What each role is called on screen (header badge, sign-in, help).
export const ROLE_LABELS: Record<Role, string> = {
  PLATFORM_ADMIN: "Figbloom staff",
  COMPANY_OWNER: "Company owner",
  ADMIN: "Fleet admin",
  DRIVER: "Driver",
  OPERATOR: "Operator",
  ACCOUNTANT: "Accountant",
  MECHANIC: "Mechanic",
  SUPERVISOR: "Supervisor",
};

export function roleLabel(role: Role | undefined | null, adminAccess?: AdminAccess | null): string {
  if (!role) return "";
  const base = ROLE_LABELS[role] ?? role;
  if (role === "ADMIN" && adminAccess && adminAccess !== "full") {
    return `${base} · ${adminAccess === "viewer" ? "view only" : "dispatcher"}`;
  }
  return base;
}
