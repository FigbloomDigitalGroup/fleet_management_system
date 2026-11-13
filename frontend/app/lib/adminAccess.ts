import { useAuth } from "../context/AuthContext";
import { AdminAccess } from "../types/auth";
import { isStaffRole, staffAbilities } from "./staffRoles";

// What the signed-in user may change, mirroring the server's central check
// in backend/middleware/auth.js (the server stays the authority — this only
// hides controls that would be rejected anyway):
// - viewer: nothing
// - dispatcher: jobs, routes, messages, alerts (and the AI agent)
// - full / company owner / platform: everything their role allows
// - staff roles (lib/staffRoles.ts): the fleet read-only, plus their own
//   work (an operator dispatches, a mechanic keeps maintenance...)
export function useAdminAccess() {
  const { user } = useAuth();
  const staff = isStaffRole(user?.role) && !user?.support ? staffAbilities(user?.role) : null;
  // Figbloom staff in a support view can look but not change anything.
  const access: AdminAccess = user?.support
    ? "viewer"
    : staff
      ? staff.canDispatch
        ? "dispatcher"
        : "viewer"
      : user?.role === "ADMIN"
        ? user.adminAccess || "full"
        : "full";
  const canManageFleet = access === "full";
  const canDispatch = access !== "viewer";
  return {
    access,
    // Vehicles, drivers, geofences, maintenance, company settings…
    canManageFleet,
    // Jobs, routes, messages, alerts
    canDispatch,
    isViewer: access === "viewer",
    // Close alerts: dispatchers, supervisors, mechanics (their kinds only)
    canCloseAlerts: canDispatch || !!staff?.canCloseAlerts,
    onlyMechanicAlerts: user?.role === "MECHANIC",
    // Maintenance records and reminders
    canMaintain: canManageFleet || !!staff?.canMaintain,
    // Sign off drivers' inspections
    canReviewInspections: canManageFleet || !!staff?.canReviewInspections,
    // Add, correct, delete and check expenses: the owner, full admins and
    // accountants (not Figbloom staff)
    canManageExpenses: (canManageFleet && user?.role !== "PLATFORM_ADMIN") || !!staff?.canManageExpenses,
  };
}

export const ADMIN_ACCESS_OPTIONS: { value: AdminAccess; label: string; description: string }[] = [
  { value: "full", label: "Full", description: "Can manage everything: vehicles, drivers, zones, settings and dispatch." },
  {
    value: "dispatcher",
    label: "Dispatcher",
    description: "Can run the day — jobs, routes, messages and alerts — but not change vehicles, drivers or settings.",
  },
  { value: "viewer", label: "Viewer", description: "Can see everything but can't change anything." },
];
