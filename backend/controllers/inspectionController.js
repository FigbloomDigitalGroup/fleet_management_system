import Inspection from "../models/Inspection.js";
import Vehicle from "../models/Vehicle.js";
import { tenantScope } from "../middleware/auth.js";
import { raiseAlert } from "../lib/alerts.js";
import { ownedUploadIds, uploadUrl } from "./uploadController.js";

// The pre-trip checklist every driver walks through. Kept server-side so the
// app and dashboard always agree on the items and their wording.
export const INSPECTION_ITEMS = [
  { key: "tyres", label: "Tyres (pressure, tread, damage)" },
  { key: "lights", label: "Headlights, brake lights & indicators" },
  { key: "brakes", label: "Brakes" },
  { key: "mirrors", label: "Mirrors & windows" },
  { key: "wipers", label: "Wipers & washer fluid" },
  { key: "horn", label: "Horn" },
  { key: "fluids", label: "Oil, coolant & no leaks" },
  { key: "seatbelts", label: "Seatbelts" },
  { key: "body", label: "Body (no new damage)" },
  { key: "safety_kit", label: "Fire extinguisher, first-aid kit & triangle" },
  { key: "documents", label: "Insurance & inspection stickers" },
];

function present(inspection) {
  const o = inspection.toObject ? inspection.toObject() : inspection;
  return { ...o, items: o.items.map((i) => ({ ...i, photoUrl: uploadUrl(i.photoUploadId) })) };
}

export function getInspectionTemplate(req, res) {
  return res.json({ items: INSPECTION_ITEMS });
}

// DRIVER — submit a checklist for their assigned vehicle. Any failed item
// raises an inspection_failed alert listing what's wrong.
export async function createInspection(req, res) {
  try {
    const vehicle = await Vehicle.findOne({ driverId: req.user.id });
    if (!vehicle) return res.status(400).json({ error: "No vehicle is assigned to you yet" });

    const submitted = Array.isArray(req.body.items) ? req.body.items : [];
    const byKey = new Map(submitted.map((i) => [i.key, i]));
    const missing = INSPECTION_ITEMS.filter((t) => typeof byKey.get(t.key)?.ok !== "boolean");
    if (missing.length) {
      return res.status(400).json({ error: `Please check every item (missing: ${missing.map((m) => m.label).join(", ")})` });
    }

    const photoIds = await ownedUploadIds(submitted.map((i) => i.photoUploadId), vehicle.companyId);
    const owned = new Set(photoIds.map(String));
    const items = INSPECTION_ITEMS.map((t) => {
      const s = byKey.get(t.key);
      return {
        key: t.key,
        label: t.label,
        ok: s.ok,
        note: s.note ? String(s.note).slice(0, 500) : null,
        photoUploadId: s.photoUploadId && owned.has(String(s.photoUploadId)) ? s.photoUploadId : null,
      };
    });
    const failed = items.filter((i) => !i.ok);
    const odometerKm = Number(req.body.odometerKm);

    const inspection = await Inspection.create({
      companyId: vehicle.companyId,
      vehicleId: vehicle._id,
      driverId: req.user.id,
      items,
      passed: failed.length === 0,
      odometerKm: Number.isFinite(odometerKm) && odometerKm >= 0 ? odometerKm : null,
      notes: req.body.notes ? String(req.body.notes).slice(0, 1000) : null,
      latitude: typeof req.body.latitude === "number" ? req.body.latitude : undefined,
      longitude: typeof req.body.longitude === "number" ? req.body.longitude : undefined,
    });

    if (failed.length) {
      await raiseAlert({
        companyId: vehicle.companyId,
        vehicleId: vehicle._id,
        type: "inspection_failed",
        message: `Pre-trip inspection failed on ${failed.length} item(s): ${failed.map((f) => f.label + (f.note ? ` (${f.note})` : "")).join("; ")}.`,
        debounceMinutes: 0,
      });
    }

    return res.status(201).json(present(inspection));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save inspection" });
  }
}

// DRIVER — their own recent inspections
export async function listMyInspections(req, res) {
  try {
    const inspections = await Inspection.find({ driverId: req.user.id })
      .populate("vehicleId", "plateNumber")
      .sort({ createdAt: -1 })
      .limit(30);
    return res.json(inspections.map(present));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your inspections" });
  }
}

// ADMIN/COMPANY_OWNER — inspections across the company, optionally for one
// vehicle or driver
export async function listInspections(req, res) {
  try {
    const filter = { ...tenantScope(req) };
    if (req.query.vehicleId) filter.vehicleId = req.query.vehicleId;
    if (req.query.driverId) filter.driverId = req.query.driverId;
    if (req.query.passed === "false") filter.passed = false;
    const inspections = await Inspection.find(filter)
      .populate("vehicleId", "plateNumber")
      .populate("driverId", "fullName")
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json(inspections.map(present));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch inspections" });
  }
}
