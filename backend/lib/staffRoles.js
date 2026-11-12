// Company staff roles (FLEET_HR_CONTRACT.md section 0): what OPERATOR,
// ACCOUNTANT, MECHANIC and SUPERVISOR may read and change, enforced
// centrally in middleware/auth.js for every request (a whitelist: anything
// not listed here is refused), and mirrored by the web app's menu
// (frontend/app/lib/staffRoles.ts) so each role only sees what it can use.
//
// - OPERATOR runs the day: jobs, routes, dispatch, messages, alerts. Reads
//   vehicles and drivers (to dispatch them) but can't change them, nor
//   settings or billing.
// - ACCOUNTANT: expenses (fuel, tolls...), billing and reports; the rest of
//   the fleet read-only. Opens HR & Payroll.
// - MECHANIC: vehicles' maintenance, inspections and defects (maintenance
//   and failed-inspection alerts); the rest read-only.
// - SUPERVISOR: reads everything in the fleet, closes alerts and signs off
//   inspections; no settings, team or billing.
//
// Drivers stay app-only and owners/full admins are unchanged; restricted
// ADMINs (dispatcher/viewer) keep their own rule in middleware/auth.js.

export const STAFF_ROLES = ["OPERATOR", "ACCOUNTANT", "MECHANIC", "SUPERVISOR"];
export const TEAM_ROLES = ["ADMIN", ...STAFF_ROLES];

export const isStaffRole = (role) => STAFF_ROLES.includes(role);

// What each role is called (job_title in fleet.staff.* events, emails).
export const ROLE_TITLES = {
  COMPANY_OWNER: "Company owner",
  ADMIN: "Fleet admin",
  DRIVER: "Driver",
  OPERATOR: "Operator",
  ACCOUNTANT: "Accountant",
  MECHANIC: "Mechanic",
  SUPERVISOR: "Supervisor",
};

// Alert types a mechanic may close: the vehicle's own condition.
export const MECHANIC_ALERT_TYPES = ["maintenance_due", "inspection_failed"];

const READ_METHODS = ["GET", "HEAD", "OPTIONS"];

// Path prefixes ("/api/x" covers "/api/x" and "/api/x/..."), or exact
// paths written with a trailing "$".
const COMMON_READ = [
  "/api/users/me",
  "/api/companies/me$",
  "/api/companies/me/stats",
  "/api/vehicles",
  "/api/users/drivers",
  "/api/tracking/live",
  "/api/tracking/address",
  "/api/tracking/history",
  "/api/geofences",
  "/api/trips",
  "/api/routes",
  "/api/alerts",
  "/api/agent/summary",
  "/api/uploads",
  // a vehicle's service history and checks show on its page for everyone
  "/api/maintenance",
  "/api/inspections",
  "/api/hr",
];

// [method, path pattern] pairs every staff role may send.
const COMMON_WRITE = [
  ["PATCH", /^\/api\/users\/me$/],
  ["PATCH", /^\/api\/users\/me\/avatar$/],
  ["POST", /^\/api\/uploads$/],
  ["POST", /^\/api\/agent\/ask$/],
  // their own leave in My HR (apply, cancel)
  ["POST", /^\/api\/hr\/my\/leave\/applications(\/[^/]+\/cancel)?$/],
];

const ANY = ["POST", "PUT", "PATCH", "DELETE"];
const ID = "[^/]+";

export const STAFF_PERMISSIONS = {
  OPERATOR: {
    read: ["/api/jobs", "/api/messages"],
    write: [
      [ANY, /^\/api\/jobs(\/.*)?$/],
      [ANY, /^\/api\/routes(\/.*)?$/],
      [ANY, /^\/api\/messages(\/.*)?$/],
      [ANY, /^\/api\/alerts(\/.*)?$/],
    ],
  },
  ACCOUNTANT: {
    read: ["/api/expenses", "/api/reports", "/api/billing/transactions/mine", "/api/billing/verify"],
    write: [
      ["POST", /^\/api\/billing\/checkout$/],
      ["POST", /^\/api\/hr\/handoff$/],
    ],
  },
  MECHANIC: {
    read: ["/api/reports"],
    write: [
      [ANY, /^\/api\/maintenance(\/.*)?$/],
      ["PATCH", new RegExp(`^/api/alerts/${ID}/resolve$`)],
      ["POST", new RegExp(`^/api/inspections/${ID}/review$`)],
    ],
  },
  SUPERVISOR: {
    read: ["/api/jobs", "/api/messages", "/api/expenses", "/api/reports"],
    write: [
      ["PATCH", new RegExp(`^/api/alerts/${ID}/resolve$`)],
      ["POST", new RegExp(`^/api/inspections/${ID}/review$`)],
    ],
  },
};

function prefixMatches(path, prefix) {
  if (prefix.endsWith("$")) return path === prefix.slice(0, -1);
  return path === prefix || path.startsWith(`${prefix}/`);
}

// May this staff role send `method` to `path`? (path without the query)
export function staffRoleAllows(role, method, path) {
  const rules = STAFF_PERMISSIONS[role];
  if (!rules) return false;
  const m = String(method).toUpperCase();
  if (READ_METHODS.includes(m)) return [...COMMON_READ, ...rules.read].some((p) => prefixMatches(path, p));
  return [...COMMON_WRITE, ...rules.write].some(([methods, pattern]) =>
    (Array.isArray(methods) ? methods.includes(m) : methods === m) && pattern.test(path)
  );
}

// The 403 sentence for a staff role's refused request, or null when allowed.
export function staffAccessDenial(req) {
  const role = req.user?.role;
  if (!isStaffRole(role)) return null;
  const path = (req.originalUrl ?? req.url ?? "").split("?")[0];
  if (staffRoleAllows(role, req.method, path)) return null;
  const title = ROLE_TITLES[role].toLowerCase();
  return READ_METHODS.includes(String(req.method).toUpperCase())
    ? `Your ${title} account can't open this. Ask the fleet owner.`
    : `Your ${title} account can't change this. Ask the fleet owner or a full admin.`;
}

// Who manages the team (Settings, Team): the owner and full admins.
export function canManageTeam(user) {
  if (!user || user.support) return false;
  return user.role === "COMPANY_OWNER" || (user.role === "ADMIN" && (user.adminAccess || "full") === "full");
}

// Who sees HR & Payroll (one click into Figbloom HR): the owner, full
// admins and accountants. HR decides real access; this only hides it.
export function canOpenHr(user) {
  if (!user || user.support) return false;
  return canManageTeam(user) || user.role === "ACCOUNTANT";
}

// Everyone in a company except Figbloom staff has a My HR page.
export function hasMyHr(user) {
  return !!user && !user.support && !!user.companyId && user.role !== "PLATFORM_ADMIN";
}
