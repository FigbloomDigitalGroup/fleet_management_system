import Route from "../models/Route.js";
import { tenantScope } from "../middleware/auth.js";

export async function createRoute(req, res) {
  try {
    const { vehicleId, name, waypoints, toleranceMeters, speedLimitKph } = req.body;
    if (!vehicleId || !name || !waypoints || waypoints.length < 2) {
      return res.status(400).json({ error: "vehicleId, name, and at least 2 waypoints are required" });
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
    return res.json(routes);
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