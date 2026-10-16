import Geofence from "../models/Geofence.js";
import Vehicle from "../models/Vehicle.js";
import LocationPing from "../models/LocationPing.js";
import { tenantScope } from "../middleware/auth.js";
import { isInsideGeofence } from "../lib/geo.js";

export async function createGeofence(req, res) {
  try {
    const { name, type, centerLat, centerLng, radiusM, polygon } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "name and type are required" });
    }
    if (type === "circle" && (centerLat === undefined || centerLng === undefined || !radiusM)) {
      return res.status(400).json({ error: "centerLat, centerLng, and radiusM are required for a circle geofence" });
    }
    if (type === "polygon" && (!polygon || polygon.length < 3)) {
      return res.status(400).json({ error: "A polygon geofence needs at least 3 points" });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    const geofence = await Geofence.create({
      companyId,
      name,
      type,
      centerLat,
      centerLng,
      radiusM,
      polygon,
    });

    return res.status(201).json(geofence);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create geofence" });
  }
}

export async function listGeofences(req, res) {
  try {
    const geofences = await Geofence.find(tenantScope(req)).sort({ createdAt: -1 });
    return res.json(geofences);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch geofences" });
  }
}

export async function deleteGeofence(req, res) {
  try {
    const geofence = await Geofence.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!geofence) return res.status(404).json({ error: "Geofence not found" });

    // Block deletion while an active vehicle is currently inside this zone —
    // removing it would silently drop the zone's protection out from under them.
    const activeVehicles = await Vehicle.find({ companyId: geofence.companyId, status: "active" });
    for (const vehicle of activeVehicles) {
      const lastPing = await LocationPing.findOne({ vehicleId: vehicle._id }).sort({ recordedAt: -1 });
      if (lastPing && isInsideGeofence(lastPing.latitude, lastPing.longitude, geofence)) {
        return res.status(409).json({
          error: `Cannot delete "${geofence.name}" — vehicle ${vehicle.plateNumber} is currently active inside this zone.`,
        });
      }
    }

    await Geofence.findByIdAndDelete(geofence._id);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete geofence" });
  }
}