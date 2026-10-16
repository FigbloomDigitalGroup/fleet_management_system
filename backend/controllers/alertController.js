import Alert from "../models/Alert.js";
import Vehicle from "../models/Vehicle.js";
import { tenantScope } from "../middleware/auth.js";

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
];

// admin_message is a message TO a driver, not an operational alert ABOUT a
// vehicle — it's excluded here so it only ever shows up on the driver's own
// phone (getMyAlerts below), never cluttering the admin/company dashboard.
export async function listAlerts(req, res) {
  try {
    const alerts = await Alert.find({ ...tenantScope(req), type: { $ne: "admin_message" } })
      .populate("vehicleId", "plateNumber")
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json(alerts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
}

export async function resolveAlert(req, res) {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      { resolved: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    return res.json(alert);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to resolve alert" });
  }
}

// DRIVER — unresolved alerts for whichever vehicle is currently assigned to them
export async function getMyAlerts(req, res) {
  try {
    const vehicle = await Vehicle.findOne({ driverId: req.user.id });
    if (!vehicle) return res.json([]);

    const alerts = await Alert.find({
      vehicleId: vehicle._id,
      resolved: false,
      type: { $in: DRIVER_VISIBLE_TYPES },
    })
      .populate("vehicleId", "plateNumber")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json(alerts);
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

    const alert = await Alert.create({ companyId, vehicleId, type, message });
    return res.status(201).json(alert);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create alert" });
  }
}






