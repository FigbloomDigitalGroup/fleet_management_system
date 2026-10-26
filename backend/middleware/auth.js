import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";

// Verifies the JWT and attaches current user info to req.user
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("role companyId adminAccess");
    if (!user) {
      return res.status(401).json({ error: "User account no longer exists" });
    }

    req.user = {
      id: user._id,
      role: user.role,
      companyId: user.companyId,
      adminAccess: user.role === "ADMIN" ? user.adminAccess || "full" : null,
    };
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const denied = adminAccessDenial(req);
  if (denied) return res.status(403).json({ error: denied });
  next();
}

// Write access for restricted company admins, checked centrally here so
// every route gets it without its own authorize() change:
// - viewer: read-only everywhere (except their own profile)
// - dispatcher: may change jobs, routes, messages and alerts, but not
//   vehicles, drivers, zones, billing or company settings
const READ_METHODS = ["GET", "HEAD", "OPTIONS"];
const ALWAYS_WRITABLE = ["/api/users/me"];
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
    const vehicle = await Vehicle.findOne({ trackerToken: deviceToken }).select("+trackerToken");
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

// Restricts a route to specific roles
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

// Builds a Mongoose filter scoped to the requester's tenant.
// PLATFORM_ADMIN sees everything; everyone else is locked to their own companyId.
export function tenantScope(req) {
  if (req.user.role === "PLATFORM_ADMIN") return {};
  return { companyId: req.user.companyId };
}