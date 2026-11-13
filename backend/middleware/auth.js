import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { SUPPORT_TOKEN_TYPE, resolveSupportSession, supportModeDenial } from "../lib/supportSession.js";
import { isStaffRole, staffAccessDenial } from "../lib/staffRoles.js";
import { resolveAccess, NO_FLEET_MESSAGE } from "../lib/session.js";

// Verifies the JWT and attaches who the request runs as to req.user:
// { id (the person), role, companyId, adminAccess (the active membership,
// FLEET_MEMBERSHIPS_CONTRACT.md section 2), isPlatformAdmin, app }. The
// membership is re-read on every request (lib/session.js resolveAccess).
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // A Figbloom staff support view (lib/supportSession.js): one company's
    // owner area as its owner sees it, read-only, checked against its session
    // row on every request.
    if (decoded?.typ === SUPPORT_TOKEN_TYPE) {
      const support = await resolveSupportSession(prisma, decoded);
      if (!support) {
        return res.status(401).json({ error: "This support view has ended or expired", code: "support_session_ended" });
      }
      req.user = support;
    } else {
      const access = await resolveAccess(prisma, decoded);
      if (access.failure) return res.status(access.failure.status).json(access.failure.body);
      // Signed in, but in no fleet: only the /api/auth account routes
      // (switch fleet, invitations, new fleet) are open to them.
      if (access.noFleet) return res.status(403).json({ error: NO_FLEET_MESSAGE, code: "no_fleet" });
      req.user = access.user;
    }
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (req.user.support) {
    const refused = supportModeDenial(req);
    if (refused) return res.status(403).json({ error: refused, code: "support_read_only" });
    return next();
  }

  const denied = adminAccessDenial(req) ?? staffAccessDenial(req);
  if (denied) return res.status(403).json({ error: denied, code: "role_forbidden" });
  next();
}

// Write access for restricted company admins, checked centrally here so
// every route gets it without its own authorize() change:
// - viewer: read-only everywhere (except their own profile)
// - dispatcher: may change jobs, routes, messages and alerts, but not
//   vehicles, drivers, zones, billing or company settings
const READ_METHODS = ["GET", "HEAD", "OPTIONS"];
// Their own profile, and their own leave in My HR (Figbloom HR).
const ALWAYS_WRITABLE = ["/api/users/me", "/api/hr/my"];
const DISPATCHER_WRITABLE = ["/api/jobs", "/api/routes", "/api/messages", "/api/alerts", "/api/agent"];

function adminAccessDenial(req) {
  const access = req.user?.adminAccess;
  if (!access || access === "full" || READ_METHODS.includes(req.method)) return null;
  const path = req.originalUrl.split("?")[0];
  const matches = (prefixes) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));
  if (matches(ALWAYS_WRITABLE)) return null;
  if (access === "dispatcher" && matches(DISPATCHER_WRITABLE)) return null;
  return access === "viewer"
    ? "Your account has view-only access"
    : "Dispatcher accounts can't change this — ask a full admin";
}

// Authenticates a location ping from either of two sources, so a future
// hardware GPS tracker can plug into the same /api/tracking/ping endpoint
// the driver app already uses, without either side needing to change:
// - A hardware device presents x-tracker-token (its per-vehicle secret,
//   see Vehicle.trackerToken) and needs no user account at all. Since the
//   token already identifies exactly one vehicle, req.trackingVehicle is
//   resolved here and the controller trusts it over anything in the body.
// - Everything else (the driver app) goes through the normal JWT flow;
//   ingestLocation then only accepts the vehicle's assigned driver.
export async function authenticateTracking(req, res, next) {
  const deviceToken = req.headers["x-tracker-token"];
  if (deviceToken) {
    const vehicle = await prisma.vehicle.findFirst({ where: { trackerToken: String(deviceToken) } });
    if (!vehicle) return res.status(401).json({ error: "Invalid tracker token" });
    req.trackingVehicle = vehicle;
    req.trackingSource = "device";
    return next();
  }

  return authenticate(req, res, () => {
    req.trackingSource = "driver_app";
    next();
  });
}

// Restricts a route to specific roles. The staff roles (OPERATOR,
// ACCOUNTANT, MECHANIC, SUPERVISOR) count as ADMIN here: authenticate has
// already narrowed them to their own whitelist (lib/staffRoles.js), so a
// route open to admins is open to them only where that list allows.
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role;
    const allowed = allowedRoles.includes(role) || (isStaffRole(role) && allowedRoles.includes("ADMIN"));
    if (!req.user || !allowed) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

// The person behind a token, whatever fleet (or none) it runs as: for the
// account routes that work across fleets (switch fleet, accept an
// invitation, start another fleet). Sets req.identity = { id, email,
// fullName, isPlatformAdmin, companyId (the token's fleet or null), app }.
// Never a support view.
export async function authenticateIdentity(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  let decoded;
  try {
    decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  if (decoded?.typ === SUPPORT_TOKEN_TYPE) {
    return res.status(403).json({ error: "Not available in a support view", code: "support_read_only" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(decoded.id) },
      select: { id: true, email: true, fullName: true, isPlatformAdmin: true, status: true },
    });
    if (!user) return res.status(401).json({ error: "User account no longer exists" });
    if (user.isPlatformAdmin && user.status && user.status !== "active") {
      return res.status(401).json({ error: "This account has been deactivated", code: "account_inactive" });
    }
    req.identity = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isPlatformAdmin: !!user.isPlatformAdmin,
      companyId: decoded.companyId ?? null,
      app: decoded.app ?? null,
    };
    next();
  } catch (err) {
    console.error("[auth] identity check failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

// Builds a Prisma where-clause scoped to the requester's tenant.
// PLATFORM_ADMIN sees everything; everyone else is locked to their own companyId.
export function tenantScope(req) {
  if (req.user.role === "PLATFORM_ADMIN") return {};
  return { companyId: req.user.companyId };
}