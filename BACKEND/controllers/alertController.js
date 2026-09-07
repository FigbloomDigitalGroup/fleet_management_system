import Alert from "../models/Alert.js";
import { tenantScope } from "../middleware/auth.js";

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






