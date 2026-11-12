import { AdminAccess, Role, StaffRole, User } from "../types/auth";

// The company staff roles (FLEET_HR_CONTRACT.md section 0), as the web app
// shows them. The API enforces each role's permissions (backend/lib/
// staffRoles.js); this only decides which menu items and buttons a role sees,
// so nobody is offered a page that would refuse them.

export const STAFF_ROLES: StaffRole[] = ["OPERATOR", "ACCOUNTANT", "MECHANIC", "SUPERVISOR"];

export function isStaffRole(role: Role | undefined | null): role is StaffRole {
  return !!role && (STAFF_ROLES as string[]).includes(role);
}

// The /admin pages (the part after /admin/) each staff role may open. Overview,
// the live map, vehicles, drivers and trips are read-only for all of them.
const FLEET_READ = ["dashboard", "live-map", "vehicles", "drivers", "trips"];
const STAFF_PAGES: Record<StaffRole, string[]> = {
  OPERATOR: [...FLEET_READ, "jobs", "routes", "geofences", "alerts", "agent", "messages"],
  ACCOUNTANT: [...FLEET_READ, "expenses", "reports", "billing", "hr"],
  MECHANIC: [...FLEET_READ, "alerts", "inspections", "reports"],
  SUPERVISOR: [...FLEET_READ, "jobs", "routes", "geofences", "alerts", "agent", "expenses", "inspections", "reports", "messages"],
};
// Everyone's own pages.
const OWN_PAGES = ["my-hr", "profile"];

// May this staff role open /admin/<page>? (other roles: always)
export function staffPageAllowed(role: Role | undefined | null, pathname: string): boolean {
  if (!isStaffRole(role)) return true;
  const page = pathname.replace(/^\/admin\/?/, "").split("/")[0] || "dashboard";
  return OWN_PAGES.includes(page) || STAFF_PAGES[role].includes(page);
}

// The owner and full admins manage the team (Team page).
export function canManageTeam(user: User | null | undefined): boolean {
  if (!user || user.support) return false;
  return user.role === "COMPANY_OWNER" || (user.role === "ADMIN" && (user.adminAccess || "full") === "full");
}

// What a role may do on the pages it sees.
export function staffAbilities(role: Role | undefined | null) {
  return {
    canDispatch: role === "OPERATOR",
    canMaintain: role === "MECHANIC",
    // close alerts (a mechanic only maintenance and inspection ones)
    canCloseAlerts: role === "OPERATOR" || role === "SUPERVISOR" || role === "MECHANIC",
    // sign off drivers' inspections
    canReviewInspections: role === "SUPERVISOR" || role === "MECHANIC",
    canPay: role === "ACCOUNTANT",
  };
}

export const MECHANIC_ALERT_TYPES = ["maintenance_due", "inspection_failed"];

// Team roles offered in the Team page: admins (with an access level) and the
// staff roles. The descriptions say in plain words what each can do.
export type TeamRoleChoice = "ADMIN:full" | "ADMIN:dispatcher" | "ADMIN:viewer" | StaffRole;

export const TEAM_ROLE_OPTIONS: { value: TeamRoleChoice; label: string; description: string }[] = [
  { value: "ADMIN:full", label: "Full admin", description: "Manages everything: vehicles, drivers, zones, settings, the team and the day's work." },
  { value: "OPERATOR", label: "Operator", description: "Runs the day: jobs, routes, dispatch, messages and alerts. Sees vehicles and drivers but can't change them." },
  { value: "ACCOUNTANT", label: "Accountant", description: "Expenses, fuel, tolls, billing and reports, and HR & Payroll. Sees the rest of the fleet read-only." },
  { value: "MECHANIC", label: "Mechanic", description: "Vehicles' maintenance, inspections and defects. Sees the rest read-only." },
  { value: "SUPERVISOR", label: "Supervisor", description: "Sees everything in the fleet, closes alerts and signs off inspections. No settings, team or billing." },
  { value: "ADMIN:dispatcher", label: "Dispatcher admin", description: "Jobs, routes, messages and alerts, but not vehicles, drivers or settings." },
  { value: "ADMIN:viewer", label: "View-only admin", description: "Can see everything but can't change anything." },
];

export function teamRoleChoice(role: string, adminAccess?: AdminAccess | null): TeamRoleChoice {
  if (role === "ADMIN") return `ADMIN:${adminAccess || "full"}` as TeamRoleChoice;
  return role as TeamRoleChoice;
}

export function teamRoleBody(choice: TeamRoleChoice): { role: string; adminAccess?: AdminAccess } {
  if (choice.startsWith("ADMIN:")) return { role: "ADMIN", adminAccess: choice.slice(6) as AdminAccess };
  return { role: choice };
}
