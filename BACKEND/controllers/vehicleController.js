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

    const nextDriverId = driverId !== undefined ? driverId : existing.driverId;
    const effectiveStatus = status !== undefined ? status : existing.status;

    // A driver can only be behind the wheel of one vehicle at a time —
    // bump them off any other vehicle they're currently assigned to.
    if (nextDriverId && String(nextDriverId) !== String(existing.driverId || "")) {
      const otherVehicle = await Vehicle.findOne({
        _id: { $ne: existing._id },
        companyId: existing.companyId,
        driverId: nextDriverId,
      });
      if (otherVehicle) {
        await Vehicle.findByIdAndUpdate(otherVehicle._id, {
          driverId: null,
          status: otherVehicle.status === "active" ? "idle" : otherVehicle.status,
        });
      }
    }

    let statusToSet = status;
    if (effectiveStatus === "active" && !nextDriverId) {
      if (status === "active") {
        return res.status(400).json({ error: "Cannot set a vehicle to active without an assigned driver" });
      }
      // Driver was just removed from an already-active vehicle — demote it automatically
      statusToSet = "idle";
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      existing._id,
      { plateNumber, make, model, deviceId, status: statusToSet, driverId },
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