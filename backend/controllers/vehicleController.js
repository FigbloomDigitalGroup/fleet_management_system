import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { toApi, isUniqueViolation } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { parseSpreadsheetRows } from "../lib/spreadsheet.js";
import { getPlatformSettings } from "./settingsController.js";

const MAX_IMPORT_ROWS = 500;

// What .populate("driverId", "fullName email avatarUploadId") and
// .populate("startGeofenceId", "name") returned.
const VEHICLE_INCLUDE = {
  driver: { select: { id: true, fullName: true, email: true, avatarUploadId: true } },
  startGeofence: { select: { id: true, name: true } },
};

// How many more vehicles this company's plan allows it to add right now —
// enforces PlatformSettings.vehicleLimits, which a platform admin configures
// but nothing previously read. Returns null if the plan has no configured
// limit (don't block on an unrecognized/custom plan key).
async function getVehicleLimitStatus(companyId) {
  const [company, settings] = await Promise.all([
    prisma.company.findUnique({ where: { id: String(companyId) }, select: { subscriptionPlan: true } }),
    getPlatformSettings(),
  ]);
  if (!company) return null;

  const limit = settings.vehicleLimits?.[company.subscriptionPlan];
  if (limit === undefined || limit === null) return null;

  const currentCount = await prisma.vehicle.count({ where: { companyId: String(companyId) } });
  return { plan: company.subscriptionPlan, limit, currentCount };
}

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
    const { plateNumber, make, model, deviceId, vehicleType, avgConsumptionLPer100Km } = req.body;
    if (!plateNumber) return res.status(400).json({ error: "plateNumber is required" });
    if (vehicleType !== undefined && !VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({ error: `vehicleType must be one of: ${VEHICLE_TYPES.join(", ")}` });
    }
    if (avgConsumptionLPer100Km !== undefined && !(Number(avgConsumptionLPer100Km) > 0)) {
      return res.status(400).json({ error: "avgConsumptionLPer100Km must be a positive number" });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    const limitStatus = await getVehicleLimitStatus(companyId);
    if (limitStatus && limitStatus.currentCount >= limitStatus.limit) {
      return res.status(403).json({
        error: `Vehicle limit reached for the ${limitStatus.plan} plan (${limitStatus.limit}). Upgrade your plan to add more vehicles.`,
      });
    }

    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    const vehicle = await prisma.vehicle.create({
      data: {
        companyId: String(companyId),
        plateNumber: String(plateNumber),
        make,
        model,
        deviceId: deviceId || null,
        vehicleType,
        avgConsumptionLPer100Km: avgConsumptionLPer100Km !== undefined ? Number(avgConsumptionLPer100Km) : undefined,
      },
    });

    // Closes the race between the limit check above and this create: if two
    // requests both passed the check at currentCount === limit - 1, only one
    // of them should actually end up over the limit — re-verify now and roll
    // this one back if the count has since crept past the limit.
    if (limitStatus) {
      const countNow = await prisma.vehicle.count({ where: { companyId: String(companyId) } });
      if (countNow > limitStatus.limit) {
        await prisma.vehicle.delete({ where: { id: vehicle.id } });
        return res.status(403).json({
          error: `Vehicle limit reached for the ${limitStatus.plan} plan (${limitStatus.limit}). Upgrade your plan to add more vehicles.`,
        });
      }
    }

    return res.status(201).json(toApi(vehicle));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "A vehicle with this plate number or device ID already exists" });
    }
    console.error(err);
    return res.status(500).json({ error: "Failed to create vehicle" });
  }
}

// Bulk-creates vehicles from an uploaded .xlsx/.csv file — same validation
// rules as createVehicle, applied per row, so one bad row doesn't block the
// rest. Expected columns (case/spacing-insensitive): plateNumber (required),
// make, model, vehicleType, deviceId, avgConsumptionLPer100Km (aka mileage).
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

    const limitStatus = companyId ? await getVehicleLimitStatus(companyId) : null;
    let remainingSlots = limitStatus ? Math.max(0, limitStatus.limit - limitStatus.currentCount) : Infinity;

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
      const mileageRaw = row.avgconsumptionlper100km || row.mileage || row.fuelconsumption || undefined;

      if (!plateNumber) {
        results.push({ row: rowNumber, plateNumber: "", status: "failed", error: "plateNumber is required" });
        continue;
      }
      if (mileageRaw !== undefined && !(Number(mileageRaw) > 0)) {
        results.push({
          row: rowNumber,
          plateNumber,
          status: "failed",
          error: "mileage (avgConsumptionLPer100Km) must be a positive number",
        });
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
      if (remainingSlots <= 0) {
        results.push({
          row: rowNumber,
          plateNumber,
          status: "failed",
          error: `Vehicle limit reached for the ${limitStatus.plan} plan (${limitStatus.limit})`,
        });
        continue;
      }

      try {
        await prisma.vehicle.create({
          data: {
            companyId: String(companyId),
            plateNumber: String(plateNumber),
            make: make === undefined ? undefined : String(make),
            model: model === undefined ? undefined : String(model),
            deviceId: deviceId === undefined ? null : String(deviceId),
            vehicleType,
            avgConsumptionLPer100Km: mileageRaw !== undefined ? Number(mileageRaw) : undefined,
          },
        });
        results.push({ row: rowNumber, plateNumber, status: "created" });
        createdCount++;
        remainingSlots--;
      } catch (err) {
        if (isUniqueViolation(err)) {
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
      scope.companyId = String(req.query.companyId);
    }

    const vehicles = await prisma.vehicle.findMany({ where: scope, include: VEHICLE_INCLUDE, orderBy: { createdAt: "desc" } });
    return res.json(toApi(vehicles));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch vehicles" });
  }
}

export async function getVehicle(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, ...tenantScope(req) },
      include: VEHICLE_INCLUDE,
    });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    return res.json(toApi(vehicle));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch vehicle" });
  }
}

export async function updateVehicle(req, res) {
  try {
    const existing = await prisma.vehicle.findFirst({ where: { id: req.params.id, ...tenantScope(req) } });
    if (!existing) return res.status(404).json({ error: "Vehicle not found" });

    const { plateNumber, make, model, deviceId, status, driverId, startGeofenceId, vehicleType, avgConsumptionLPer100Km } =
      req.body;
    const update = {};
    if (plateNumber !== undefined) update.plateNumber = plateNumber;
    if (make !== undefined) update.make = make;
    if (model !== undefined) update.model = model;
    if (deviceId !== undefined) update.deviceId = deviceId;
    if (avgConsumptionLPer100Km !== undefined) {
      if (!(Number(avgConsumptionLPer100Km) > 0)) {
        return res.status(400).json({ error: "avgConsumptionLPer100Km must be a positive number" });
      }
      update.avgConsumptionLPer100Km = Number(avgConsumptionLPer100Km);
    }
    if (req.body.odometerBaseKm !== undefined) {
      const km = Number(req.body.odometerBaseKm);
      if (!Number.isFinite(km) || km < 0) return res.status(400).json({ error: "odometerBaseKm must be 0 or more" });
      update.odometerBaseKm = km;
    }
    if (status !== undefined) {
      update.status = status;
      // Marks this as a deliberate admin choice so tracking pings leave it
      // alone until the vehicle is seen moving again (see ingestLocation).
      update.statusManuallySet = true;
    }
    if (driverId !== undefined) {
      // Mongo accepted any id here; Postgres enforces the link, so check it.
      if (driverId) {
        const driver = await prisma.user.findFirst({
          where: { id: String(driverId), companyId: existing.companyId, role: "DRIVER" },
          select: { id: true },
        });
        if (!driver) return res.status(400).json({ error: "That driver doesn't belong to this vehicle's company" });
      }
      update.driverId = driverId ? String(driverId) : null;
    }
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
        const geofence = await prisma.geofence.findFirst({
          where: { id: String(startGeofenceId), companyId: existing.companyId },
          select: { id: true },
        });
        if (!geofence) {
          return res.status(400).json({ error: "That geofence zone doesn't belong to this vehicle's company" });
        }
        update.startGeofenceId = geofence.id;
      }
    }

    const vehicle = await prisma.vehicle.update({ where: { id: existing.id }, data: update, include: VEHICLE_INCLUDE });
    return res.json(toApi(vehicle));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "A vehicle with this plate number or device ID already exists" });
    }
    console.error(err);
    return res.status(500).json({ error: "Failed to update vehicle" });
  }
}

export async function deleteVehicle(req, res) {
  try {
    const existing = await prisma.vehicle.findFirst({ where: { id: req.params.id, ...tenantScope(req) }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "Vehicle not found" });

    await prisma.vehicle.delete({ where: { id: existing.id } });
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
// back out via listVehicles/getVehicle (lib/serialize.js hides it).
export async function regenerateTrackerToken(req, res) {
  try {
    const existing = await prisma.vehicle.findFirst({ where: { id: req.params.id, ...tenantScope(req) }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "Vehicle not found" });

    const trackerToken = crypto.randomBytes(24).toString("hex");
    await prisma.vehicle.update({ where: { id: existing.id }, data: { trackerToken } });

    return res.json({ trackerToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate tracker token" });
  }
}

// DRIVER — get the vehicle currently assigned to the logged-in driver
export async function getMyVehicle(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { driverId: req.user.id },
      include: { driver: VEHICLE_INCLUDE.driver },
    });
    return res.json(vehicle ? toApi(vehicle) : null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch assigned vehicle" });
  }
}