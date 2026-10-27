import mongoose from "mongoose";
import MaintenanceRecord from "../models/MaintenanceRecord.js";
import Vehicle from "../models/Vehicle.js";
import Trip from "../models/Trip.js";
import { tenantScope } from "../middleware/auth.js";
import { raiseAlert } from "../lib/alerts.js";

// Odometer = the reading entered at onboarding (odometerBaseKm) plus every
// kilometre recorded on trips since.
export async function currentOdometerKm(vehicle) {
  const [row] = await Trip.aggregate([
    { $match: { vehicleId: new mongoose.Types.ObjectId(String(vehicle._id)) } },
    { $group: { _id: null, km: { $sum: { $ifNull: ["$distanceKm", 0] } } } },
  ]);
  return Math.round(((vehicle.odometerBaseKm || 0) + (row?.km || 0)) * 10) / 10;
}

const numOrNull = (v) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const dateOrNull = (v) => (v ? new Date(v) : null);

function reminderState(r, odometerKm) {
  if (r.kind !== "reminder" || r.status === "done") return null;
  const byDate = r.dueDate && new Date(r.dueDate) <= new Date();
  const byKm = r.dueOdometerKm != null && odometerKm >= r.dueOdometerKm;
  const soonDate = r.dueDate && new Date(r.dueDate) <= new Date(Date.now() + 7 * 86400000);
  const soonKm = r.dueOdometerKm != null && odometerKm >= r.dueOdometerKm - 500;
  return byDate || byKm ? "overdue" : soonDate || soonKm ? "due_soon" : "upcoming";
}

// ADMIN/COMPANY_OWNER — a vehicle's service history and open reminders,
// with its current odometer and each reminder's due state.
export async function listMaintenance(req, res) {
  try {
    const filter = { ...tenantScope(req) };
    if (req.query.vehicleId) filter.vehicleId = req.query.vehicleId;
    const items = await MaintenanceRecord.find(filter).populate("vehicleId", "plateNumber odometerBaseKm").sort({ createdAt: -1 }).limit(500);

    const odometers = new Map();
    for (const i of items) {
      const v = i.vehicleId;
      if (v && !odometers.has(String(v._id))) odometers.set(String(v._id), await currentOdometerKm(v));
    }
    let vehicleOdometerKm = null;
    if (req.query.vehicleId) {
      const v = await Vehicle.findOne({ _id: req.query.vehicleId, ...tenantScope(req) }).select("odometerBaseKm");
      if (v) vehicleOdometerKm = await currentOdometerKm(v);
    }

    return res.json({
      odometerKm: vehicleOdometerKm,
      items: items.map((i) => {
        const odo = i.vehicleId ? odometers.get(String(i.vehicleId._id)) : null;
        return { ...i.toObject(), state: reminderState(i, odo ?? 0) };
      }),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch maintenance" });
  }
}

export async function createMaintenance(req, res) {
  try {
    const { vehicleId, kind, title } = req.body;
    if (!["record", "reminder"].includes(kind)) return res.status(400).json({ error: "kind must be record or reminder" });
    if (!title?.trim()) return res.status(400).json({ error: "title is required" });
    const vehicle = await Vehicle.findOne({ _id: vehicleId, ...tenantScope(req) });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const doc = {
      companyId: vehicle.companyId,
      vehicleId: vehicle._id,
      kind,
      title: title.trim(),
      notes: req.body.notes || null,
    };
    if (kind === "record") {
      Object.assign(doc, {
        performedAt: dateOrNull(req.body.performedAt) || new Date(),
        odometerKm: numOrNull(req.body.odometerKm),
        costKes: numOrNull(req.body.costKes),
        status: "done",
      });
    } else {
      const intervalKm = numOrNull(req.body.intervalKm);
      const intervalDays = numOrNull(req.body.intervalDays);
      let dueDate = dateOrNull(req.body.dueDate);
      let dueOdometerKm = numOrNull(req.body.dueOdometerKm);
      // An interval with no explicit due point counts from today/now.
      if (!dueDate && intervalDays) dueDate = new Date(Date.now() + intervalDays * 86400000);
      if (dueOdometerKm == null && intervalKm) dueOdometerKm = (await currentOdometerKm(vehicle)) + intervalKm;
      if (!dueDate && dueOdometerKm == null) {
        return res.status(400).json({ error: "A reminder needs a due date, a due odometer reading, or an interval" });
      }
      Object.assign(doc, { dueDate, dueOdometerKm, intervalKm, intervalDays });
    }
    const item = await MaintenanceRecord.create(doc);
    return res.status(201).json(item);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save maintenance" });
  }
}

export async function updateMaintenance(req, res) {
  try {
    const item = await MaintenanceRecord.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!item) return res.status(404).json({ error: "Not found" });
    for (const f of ["title", "notes"]) if (f in req.body) item[f] = req.body[f];
    for (const f of ["odometerKm", "costKes", "dueOdometerKm", "intervalKm", "intervalDays"]) if (f in req.body) item[f] = numOrNull(req.body[f]);
    for (const f of ["performedAt", "dueDate"]) if (f in req.body) item[f] = dateOrNull(req.body[f]);
    if ("dueDate" in req.body || "dueOdometerKm" in req.body) item.alertedAt = null;
    await item.save();
    return res.json(item);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update maintenance" });
  }
}

export async function deleteMaintenance(req, res) {
  try {
    const item = await MaintenanceRecord.findOneAndDelete({ _id: req.params.id, ...tenantScope(req) });
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete maintenance" });
  }
}

// Marks a reminder done: logs it as a service record and, for a repeating
// reminder, schedules the next one from today's date/odometer.
export async function completeReminder(req, res) {
  try {
    const reminder = await MaintenanceRecord.findOne({ _id: req.params.id, kind: "reminder", ...tenantScope(req) });
    if (!reminder) return res.status(404).json({ error: "Reminder not found" });
    if (reminder.status === "done") return res.status(400).json({ error: "Already completed" });
    const vehicle = await Vehicle.findById(reminder.vehicleId);
    const odometerKm = await currentOdometerKm(vehicle);

    reminder.status = "done";
    await reminder.save();
    const record = await MaintenanceRecord.create({
      companyId: reminder.companyId,
      vehicleId: reminder.vehicleId,
      kind: "record",
      title: reminder.title,
      notes: req.body.notes || reminder.notes,
      performedAt: new Date(),
      odometerKm: numOrNull(req.body.odometerKm) ?? odometerKm,
      costKes: numOrNull(req.body.costKes),
      status: "done",
    });

    let next = null;
    if (reminder.intervalDays || reminder.intervalKm) {
      next = await MaintenanceRecord.create({
        companyId: reminder.companyId,
        vehicleId: reminder.vehicleId,
        kind: "reminder",
        title: reminder.title,
        notes: reminder.notes,
        intervalDays: reminder.intervalDays,
        intervalKm: reminder.intervalKm,
        dueDate: reminder.intervalDays ? new Date(Date.now() + reminder.intervalDays * 86400000) : null,
        dueOdometerKm: reminder.intervalKm ? (record.odometerKm ?? odometerKm) + reminder.intervalKm : null,
      });
    }
    return res.json({ record, next });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to complete reminder" });
  }
}

// Scheduled (index.js) — one maintenance_due alert per reminder once it's
// due by date or odometer.
export async function sweepMaintenanceReminders() {
  const reminders = await MaintenanceRecord.find({ kind: "reminder", status: "open", alertedAt: null });
  let alerted = 0;
  for (const r of reminders) {
    const vehicle = await Vehicle.findById(r.vehicleId).select("plateNumber odometerBaseKm companyId");
    if (!vehicle) continue;
    const odo = await currentOdometerKm(vehicle);
    if (reminderState(r, odo) !== "overdue") continue;
    const why = r.dueDate && new Date(r.dueDate) <= new Date()
      ? `was due on ${new Date(r.dueDate).toLocaleDateString("en-GB")}`
      : `was due at ${r.dueOdometerKm} km (odometer now ${odo} km)`;
    await raiseAlert({
      companyId: r.companyId,
      vehicleId: r.vehicleId,
      type: "maintenance_due",
      message: `${r.title} for ${vehicle.plateNumber} ${why}.`,
      debounceMinutes: 0,
    });
    r.alertedAt = new Date();
    await r.save();
    alerted += 1;
  }
  return alerted;
}
