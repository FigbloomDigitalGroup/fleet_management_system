import Vehicle from "../models/Vehicle.js";
import { tenantScope } from "../middleware/auth.js";

export async function createVehicle(req, res) {
  try {
    const { plateNumber, make, model, deviceId } = req.body;
    if (!plateNumber) return res.status(400).json({ error: "plateNumber is required" });

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    const vehicle = await Vehicle.create({ companyId, plateNumber, make, model, deviceId });
    return res.status(201).json(vehicle);
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: "A vehicle with this plate number or device ID already exists" });
    }
    return res.status(500).json({ error: "Failed to create vehicle" });
  }
}

export async function listVehicles(req, res) {
  try {
    const vehicles = await Vehicle.find(tenantScope(req))
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });
    return res.json(vehicles);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch vehicles" });
  }
}

export async function getVehicle(req, res) {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantScope(req) }).populate(
      "driverId",
      "fullName email"
    );
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    return res.json(vehicle);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch vehicle" });
  }
}

export async function updateVehicle(req, res) {
  try {
    const existing = await Vehicle.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) return res.status(404).json({ error: "Vehicle not found" });

    const { plateNumber, make, model, deviceId, status, driverId } = req.body;
    const vehicle = await Vehicle.findByIdAndUpdate(
      existing._id,
      { plateNumber, make, model, deviceId, status, driverId },
      { new: true }
    );
    return res.json(vehicle);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update vehicle" });
  }
}

// Company Owner only — deleting is a bigger, harder-to-reverse action
export async function deleteVehicle(req, res) {
  try {
    const existing = await Vehicle.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) return res.status(404).json({ error: "Vehicle not found" });

    await Vehicle.findByIdAndDelete(existing._id);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete vehicle" });
  }
}