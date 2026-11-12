import { AdminAccess, Role } from "../types/auth";

// Every role lands on its own area's dashboard after signing in, and is sent
// back there if it opens a page from another role's area (ProtectedRoute).
export function redirectPathForRole(role: Role): string {
  switch (role) {
    case "PLATFORM_ADMIN":
      return "/platform/dashboard";
    case "COMPANY_OWNER":
      return "/company/dashboard";
    case "ADMIN":
      return "/admin/dashboard";
    case "DRIVER":
      return "/driver/dashboard";
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
};

export function roleLabel(role: Role | undefined | null, adminAccess?: AdminAccess | null): string {
  if (!role) return "";
  const base = ROLE_LABELS[role] ?? role;
  if (role === "ADMIN" && adminAccess && adminAccess !== "full") {
    return `${base} · ${adminAccess === "viewer" ? "view only" : "dispatcher"}`;
  }
  return base;
}
