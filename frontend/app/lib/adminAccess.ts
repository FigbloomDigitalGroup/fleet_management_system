import { useAuth } from "../context/AuthContext";
import { AdminAccess } from "../types/auth";

// What the signed-in user may change, mirroring the server's central check
// in backend/middleware/auth.js (the server stays the authority — this only
// hides controls that would be rejected anyway):
// - viewer: nothing
// - dispatcher: jobs, routes, messages, alerts (and the AI agent)
// - full / company owner / platform: everything their role allows
export function useAdminAccess() {
  const { user } = useAuth();
  const access: AdminAccess = user?.role === "ADMIN" ? user.adminAccess || "full" : "full";
  return {
    access,
    // Vehicles, drivers, geofences, maintenance, company settings…
    canManageFleet: access === "full",
    // Jobs, routes, messages, alerts
    canDispatch: access !== "viewer",
    isViewer: access === "viewer",
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
