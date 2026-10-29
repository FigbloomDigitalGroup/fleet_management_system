import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
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
  const plain = toApi(route);
  const scheduledToday = isScheduledToday(plain, now);
  if (!scheduledToday) {
    return { ...plain, scheduledToday: false, completedToday: false, completedAt: null };
  }

  const dateKey = now.toISOString().slice(0, 10);
  const completion = await prisma.routeCompletion.findFirst({ where: { routeId: route.id, dateKey } });
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

    // Mongo accepted any vehicleId; the vehicle must belong to the company.
    const vehicle = companyId
      ? await prisma.vehicle.findFirst({ where: { id: String(vehicleId), companyId: String(companyId) }, select: { id: true } })
      : null;
    if (!vehicle) return res.status(400).json({ error: "That vehicle doesn't belong to this company" });

    // Deactivate any existing active route for this vehicle — only one active route at a time
    const [, route] = await prisma.$transaction([
      prisma.route.updateMany({ where: { vehicleId: vehicle.id, active: true }, data: { active: false } }),
      prisma.route.create({
        data: {
          companyId: String(companyId),
          vehicleId: vehicle.id,
          name: String(name),
          waypoints: waypoints.map((w) => ({ lat: Number(w.lat), lng: Number(w.lng) })),
          toleranceMeters: Number(toleranceMeters) || 300,
          speedLimitKph: Number(speedLimitKph) || null,
          frequency: frequency || "daily",
          daysOfWeek:
            frequency === "weekly" && Array.isArray(daysOfWeek)
              ? daysOfWeek.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
              : [],
          source: source || "manual",
        },
      }),
    ]);

    return res.status(201).json(toApi(route));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create route" });
  }
}

export async function listRoutes(req, res) {
  try {
    const routes = await prisma.route.findMany({
      where: tenantScope(req),
      include: { vehicle: { select: { id: true, plateNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
    const withStatus = await Promise.all(routes.map((r) => withTodayStatus(r)));
    return res.json(withStatus);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch routes" });
  }
}

export async function getRouteForVehicle(req, res) {
  try {
    const route = await prisma.route.findFirst({
      where: { vehicleId: req.params.vehicleId, active: true, ...tenantScope(req) },
      orderBy: { createdAt: "asc" },
    });
    return res.json(route ? toApi(route) : null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch route" });
  }
}

// DRIVER — the active route assigned to the vehicle currently driven by the
// logged-in driver, or null if they have no vehicle or it has no active route.
export async function getMyRoute(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id }, select: { id: true } });
    if (!vehicle) return res.json(null);

    const route = await prisma.route.findFirst({ where: { vehicleId: vehicle.id, active: true }, orderBy: { createdAt: "asc" } });
    if (!route) return res.json(null);

    return res.json(await withTodayStatus(route));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch route" });
  }
}

export async function deleteRoute(req, res) {
  try {
    const { count } = await prisma.route.deleteMany({ where: { id: req.params.id, ...tenantScope(req) } });
    if (!count) return res.status(404).json({ error: "Route not found" });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete route" });
  }
}