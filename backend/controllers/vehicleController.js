import crypto from "crypto";
import Vehicle from "../models/Vehicle.js";
import Geofence from "../models/Geofence.js";
import { tenantScope } from "../middleware/auth.js";
import { parseSpreadsheetRows } from "../lib/spreadsheet.js";

const MAX_IMPORT_ROWS = 500;

const VEHICLE_TYPES = [
  "car",
  "van",
  "truck",
  "bus",
  "motorcycle",
  "tractor",
  "excavator",
  "crane",
  "dump_truck",
  "tanker",
  "armored_vehicle",
  "trailer",
];

export async function createVehicle(req, res) {
  try {
    const { plateNumber, make, model, deviceId, vehicleType } = req.body;
    if (!plateNumber) return res.status(400).json({ error: "plateNumber is required" });
    if (vehicleType !== undefined && !VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({ error: `vehicleType must be one of: ${VEHICLE_TYPES.join(", ")}` });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    const vehicle = await Vehicle.create({ companyId, plateNumber, make, model, deviceId, vehicleType });
    return res.status(201).json(vehicle);
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: "A vehicle with this plate number or device ID already exists" });
    }
    return res.status(500).json({ error: "Failed to create vehicle" });
  }
}

// Bulk-creates vehicles from an uploaded .xlsx/.csv file — same validation
// rules as createVehicle, applied per row, so one bad row doesn't block the
// rest. Expected columns (case/spacing-insensitive): plateNumber (required),
// make, model, vehicleType, deviceId.
export async function bulkImportVehicles(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let rows;
    try {
      rows = await parseSpreadsheetRows(req.file.buffer, req.file.originalname);
    } catch (err) {
      return res.status(400).json({ error: "Could not read that file — make sure it's a valid .xlsx or .csv" });
    }

    if (rows.length === 0) return res.status(400).json({ error: "The file has no data rows" });
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `Too many rows — max ${MAX_IMPORT_ROWS} per import` });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    const results = [];
    let createdCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // header is row 1
      const plateNumber = row.platenumber || row.plate || "";
      const make = row.make || undefined;
      const model = row.model || undefined;
      const deviceId = row.deviceid || row.device || undefined;
      let vehicleType = row.vehicletype || row.type || undefined;

      if (!plateNumber) {
        results.push({ row: rowNumber, plateNumber: "", status: "failed", error: "plateNumber is required" });
        continue;
      }
      if (vehicleType) {
        vehicleType = String(vehicleType).trim().toLowerCase().replace(/\s+/g, "_");
        if (!VEHICLE_TYPES.includes(vehicleType)) {
          results.push({
            row: rowNumber,
            plateNumber,
            status: "failed",
            error: `vehicleType must be one of: ${VEHICLE_TYPES.join(", ")}`,
          });
          continue;
        }
      }
      if (!companyId) {
        results.push({ row: rowNumber, plateNumber, status: "failed", error: "companyId is required" });
        continue;
      }

      try {
        await Vehicle.create({ companyId, plateNumber, make, model, deviceId, vehicleType });
        results.push({ row: rowNumber, plateNumber, status: "created" });
        createdCount++;
      } catch (err) {
        if (err.code === 11000) {
          results.push({
            row: rowNumber,
            plateNumber,
            status: "failed",
            error: "A vehicle with this plate number or device ID already exists",
          });
        } else {
          results.push({ row: rowNumber, plateNumber, status: "failed", error: "Could not save this row" });
        }
      }
    }

    return res.status(201).json({ createdCount, failedCount: results.length - createdCount, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to import vehicles" });
  }
}

export async function listVehicles(req, res) {
  try {
    const scope = tenantScope(req);
    // PLATFORM_ADMIN isn't tied to one company (tenantScope returns {} for
    // them), so let them optionally narrow to a single company's vehicles —
    // e.g. from that company's detail page.
    if (req.user.role === "PLATFORM_ADMIN" && req.query.companyId) {
      scope.companyId = req.query.companyId;
    }

    const vehicles = await Vehicle.find(scope)
      .populate("driverId", "fullName email")
      .populate("startGeofenceId", "name")
      .sort({ createdAt: -1 });
    return res.json(vehicles);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch vehicles" });
  }
}

export async function getVehicle(req, res) {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate("driverId", "fullName email")
      .populate("startGeofenceId", "name");
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

    const { plateNumber, make, model, deviceId, status, driverId, startGeofenceId, vehicleType } = req.body;
    const update = {};
    if (plateNumber !== undefined) update.plateNumber = plateNumber;
    if (make !== undefined) update.make = make;
    if (model !== undefined) update.model = model;
    if (deviceId !== undefined) update.deviceId = deviceId;
    if (status !== undefined) {
      update.status = status;
      // Marks this as a deliberate admin choice so tracking pings leave it
      // alone until the vehicle is seen moving again (see ingestLocation).
      update.statusManuallySet = true;
    }
    if (driverId !== undefined) update.driverId = driverId || null;
    if (vehicleType !== undefined) {
      if (!VEHICLE_TYPES.includes(vehicleType)) {
        return res.status(400).json({ error: `vehicleType must be one of: ${VEHICLE_TYPES.join(", ")}` });
      }
      update.vehicleType = vehicleType;
    }

    if (startGeofenceId !== undefined) {
      if (!startGeofenceId) {
        update.startGeofenceId = null;
      } else {
        const geofence = await Geofence.findOne({ _id: startGeofenceId, companyId: existing.companyId });
        if (!geofence) {
          return res.status(400).json({ error: "That geofence zone doesn't belong to this vehicle's company" });
        }
        update.startGeofenceId = geofence._id;
      }
    }

    const vehicle = await Vehicle.findByIdAndUpdate(existing._id, update, { new: true })
      .populate("driverId", "fullName email")
      .populate("startGeofenceId", "name");
    return res.json(vehicle);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update vehicle" });
  }
}

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

// Issues (or rotates) the secret a hardware GPS tracker presents to
// authenticate its own pings (x-tracker-token header on POST /api/tracking/ping)
// — see authenticateTracking in middleware/auth.js. Only returned here, right
// after generation; it's select:false everywhere else so it's never leaked
// back out via listVehicles/getVehicle.
export async function regenerateTrackerToken(req, res) {
  try {
    const existing = await Vehicle.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) return res.status(404).json({ error: "Vehicle not found" });

    const trackerToken = crypto.randomBytes(24).toString("hex");
    existing.trackerToken = trackerToken;
    await existing.save();

    return res.json({ trackerToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate tracker token" });
  }
}

// DRIVER — get the vehicle currently assigned to the logged-in driver
export async function getMyVehicle(req, res) {
  try {
    const vehicle = await Vehicle.findOne({ driverId: req.user.id }).populate("driverId", "fullName email");
    return res.json(vehicle || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch assigned vehicle" });
  }
}