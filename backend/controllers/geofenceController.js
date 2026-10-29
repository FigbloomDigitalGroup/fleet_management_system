import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
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

    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    if (!["circle", "polygon"].includes(type)) return res.status(400).json({ error: "type must be circle or polygon" });

    const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
    const geofence = await prisma.geofence.create({
      data: {
        companyId: String(companyId),
        name: String(name),
        type,
        centerLat: num(centerLat),
        centerLng: num(centerLng),
        radiusM: num(radiusM),
        polygon: (polygon || []).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
      },
    });

    return res.status(201).json(toApi(geofence));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create geofence" });
  }
}

export async function listGeofences(req, res) {
  try {
    const geofences = await prisma.geofence.findMany({ where: tenantScope(req), orderBy: { createdAt: "desc" } });
    return res.json(toApi(geofences));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch geofences" });
  }
}

export async function deleteGeofence(req, res) {
  try {
    const geofence = await prisma.geofence.findFirst({ where: { id: req.params.id, ...tenantScope(req) } });
    if (!geofence) return res.status(404).json({ error: "Geofence not found" });

    // Block deletion while an active vehicle is currently inside this zone —
    // removing it would silently drop the zone's protection out from under them.
    const activeVehicles = await prisma.vehicle.findMany({
      where: { companyId: geofence.companyId, status: "active" },
      select: { id: true, plateNumber: true },
    });
    for (const vehicle of activeVehicles) {
      const lastPing = await prisma.locationPing.findFirst({
        where: { vehicleId: vehicle.id },
        orderBy: { recordedAt: "desc" },
        select: { latitude: true, longitude: true },
      });
      if (lastPing && isInsideGeofence(lastPing.latitude, lastPing.longitude, geofence)) {
        return res.status(409).json({
          error: `Cannot delete "${geofence.name}" — vehicle ${vehicle.plateNumber} is currently active inside this zone.`,
        });
      }
    }

    await prisma.geofence.delete({ where: { id: geofence.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete geofence" });
  }
}