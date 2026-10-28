import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { AlertType } from "@prisma/client";

// Every alert type the database accepts (the AlertType enum in schema.prisma).
const ALERT_TYPES = Object.values(AlertType);

// Alert types relevant to the driver actually behind the wheel — excludes
// admin-facing types like maintenance scheduling or device connectivity.
// admin_message is a direct note from ADMIN/COMPANY_OWNER to this driver
// specifically (see createAlert) — always driver-visible, by definition.
const DRIVER_VISIBLE_TYPES = [
  "speeding",
  "route_deviation",
  "fuel_anomaly",
  "geofence_entry",
  "geofence_exit",
  "ai_pattern_anomaly",
  "sos",
  "harsh_braking",
  "harsh_acceleration",
  "excessive_idling",
  "admin_message",
  "harsh_cornering",
  "phone_use",
  "mock_location",
  "inspection_failed",
];

// admin_message is a message TO a driver, not an operational alert ABOUT a
// vehicle — it's excluded here so it only ever shows up on the driver's own
// phone (getMyAlerts below), never cluttering the admin/company dashboard.
export async function listAlerts(req, res) {
  try {
    const alerts = await prisma.alert.findMany({
      where: { ...tenantScope(req), type: { not: "admin_message" } },
      include: { vehicle: { select: { id: true, plateNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json(toApi(alerts));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
}

export async function resolveAlert(req, res) {
  try {
    const alert = await prisma.alert.findFirst({ where: { id: req.params.id, ...tenantScope(req) }, select: { id: true } });
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    // lib/cleanup.js deletes it 30 minutes after resolvedAt.
    const resolved = await prisma.alert.update({ where: { id: alert.id }, data: { resolved: true, resolvedAt: new Date() } });
    return res.json(toApi(resolved));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to resolve alert" });
  }
}

// DRIVER — unresolved alerts for whichever vehicle is currently assigned to them
export async function getMyAlerts(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id }, select: { id: true } });
    if (!vehicle) return res.json([]);

    const alerts = await prisma.alert.findMany({
      where: { vehicleId: vehicle.id, resolved: false, hiddenForDriverAt: null, type: { in: DRIVER_VISIBLE_TYPES } },
      include: { vehicle: { select: { id: true, plateNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return res.json(toApi(alerts));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your alerts" });
  }
}

export async function createAlert(req, res) {
  try {
    const { vehicleId, type, message } = req.body;

    if (!vehicleId || !type || !message) {
      return res.status(400).json({ error: "vehicleId, type, and message are required" });
    }
    if (type === "admin_message" && !["ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only fleet admins can message a driver" });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    // Mongo accepted any vehicleId; the vehicle must belong to the company.
    const vehicle = companyId
      ? await prisma.vehicle.findFirst({ where: { id: String(vehicleId), companyId: String(companyId) }, select: { id: true } })
      : null;
    if (!vehicle) return res.status(400).json({ error: "That vehicle doesn't belong to this company" });
    if (!ALERT_TYPES.includes(type)) return res.status(400).json({ error: "Unknown alert type" });

    const alert = await prisma.alert.create({
      data: { companyId: String(companyId), vehicleId: vehicle.id, type, message: String(message) },
    });
    return res.status(201).json(toApi(alert));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create alert" });
  }
}

// DRIVER — delete an alert from their phone. Only hides it for them; the
// dashboard keeps it until an admin resolves it.
export async function hideMyAlert(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id }, select: { id: true } });
    if (!vehicle) return res.status(404).json({ error: "Alert not found" });
    const { count } = await prisma.alert.updateMany({
      where: { id: req.params.id, vehicleId: vehicle.id },
      data: { hiddenForDriverAt: new Date() },
    });
    if (!count) return res.status(404).json({ error: "Alert not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete alert" });
  }
}
