import Alert from "../models/Alert.js";
import Vehicle from "../models/Vehicle.js";
import { tenantScope } from "../middleware/auth.js";

// Alert types relevant to the driver actually behind the wheel — excludes
// admin-facing types like maintenance scheduling or device connectivity.
const DRIVER_VISIBLE_TYPES = [
  "speeding",
  "route_deviation",
  "fuel_anomaly",
  "geofence_entry",
  "geofence_exit",
  "ai_pattern_anomaly",
  "sos",
];

export async function listAlerts(req, res) {
  try {
    const alerts = await Alert.find(tenantScope(req))
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

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    const alert = await Alert.create({ companyId, vehicleId, type, message });
    return res.status(201).json(alert);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create alert" });
  }
}






