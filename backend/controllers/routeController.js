import Route from "../models/Route.js";
import Vehicle from "../models/Vehicle.js";
import RouteCompletion from "../models/RouteCompletion.js";
import { tenantScope } from "../middleware/auth.js";

// A "weekly" route with no days picked behaves like "daily" (matches the
// frontend's own frequencyLabel fallback) — otherwise only scheduled on the
// chosen days.
function isScheduledToday(route, now = new Date()) {
  if (route.frequency !== "weekly") return true;
  if (!route.daysOfWeek || route.daysOfWeek.length === 0) return true;
  return route.daysOfWeek.includes(now.getDay());
}

// Attaches today's completion status to a route — whether it's even
// expected today, and if so, whether the vehicle has already reached the
// destination (set by trackingController.ingestLocation on arrival).
async function withTodayStatus(route, now = new Date()) {
  const plain = route.toObject ? route.toObject() : route;
  const scheduledToday = isScheduledToday(plain, now);
  if (!scheduledToday) {
    return { ...plain, scheduledToday: false, completedToday: false, completedAt: null };
  }

  const dateKey = now.toISOString().slice(0, 10);
  const completion = await RouteCompletion.findOne({ routeId: plain._id, dateKey });
  return {
    ...plain,
    scheduledToday: true,
    completedToday: !!completion,
    completedAt: completion?.completedAt || null,
  };
}

export async function createRoute(req, res) {
  try {
    const { vehicleId, name, waypoints, toleranceMeters, speedLimitKph, frequency, daysOfWeek, source } = req.body;
    if (!vehicleId || !name || !waypoints || waypoints.length < 2) {
      return res.status(400).json({ error: "vehicleId, name, and at least 2 waypoints are required" });
    }
    if (frequency && !["daily", "weekly"].includes(frequency)) {
      return res.status(400).json({ error: "frequency must be 'daily' or 'weekly'" });
    }
    if (source && !["manual", "ai"].includes(source)) {
      return res.status(400).json({ error: "source must be 'manual' or 'ai'" });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    // Deactivate any existing active route for this vehicle — only one active route at a time
    await Route.updateMany({ vehicleId, active: true }, { active: false });

    const route = await Route.create({
      companyId,
      vehicleId,
      name,
      waypoints,
      toleranceMeters: toleranceMeters || 300,
      speedLimitKph: speedLimitKph || null,
      frequency: frequency || "daily",
      daysOfWeek: frequency === "weekly" && Array.isArray(daysOfWeek) ? daysOfWeek : [],
      source: source || "manual",
    });

    return res.status(201).json(route);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create route" });
  }
}

export async function listRoutes(req, res) {
  try {
    const routes = await Route.find(tenantScope(req)).populate("vehicleId", "plateNumber").sort({ createdAt: -1 });
    const withStatus = await Promise.all(routes.map((r) => withTodayStatus(r)));
    return res.json(withStatus);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch routes" });
  }
}

export async function getRouteForVehicle(req, res) {
  try {
    const route = await Route.findOne({ vehicleId: req.params.vehicleId, active: true, ...tenantScope(req) });
    return res.json(route || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch route" });
  }
}

// DRIVER — the active route assigned to the vehicle currently driven by the
// logged-in driver, or null if they have no vehicle or it has no active route.
export async function getMyRoute(req, res) {
  try {
    const vehicle = await Vehicle.findOne({ driverId: req.user.id });
    if (!vehicle) return res.json(null);

    const route = await Route.findOne({ vehicleId: vehicle._id, active: true });
    if (!route) return res.json(null);

    return res.json(await withTodayStatus(route));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch route" });
  }
}

export async function deleteRoute(req, res) {
  try {
    const route = await Route.findOneAndDelete({ _id: req.params.id, ...tenantScope(req) });
    if (!route) return res.status(404).json({ error: "Route not found" });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete route" });
  }
}