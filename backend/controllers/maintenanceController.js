import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { raiseAlert } from "../lib/alerts.js";

// Odometer = the reading entered at onboarding (odometerBaseKm) plus every
// kilometre recorded on trips since.
export async function currentOdometerKm(vehicle) {
  const row = await prisma.trip.aggregate({ where: { vehicleId: vehicle.id }, _sum: { distanceKm: true } });
  return Math.round(((vehicle.odometerBaseKm || 0) + (row._sum.distanceKm || 0)) * 10) / 10;
}

const numOrNull = (v) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const dateOrNull = (v) => (v ? new Date(v) : null);
const intOrNull = (v) => (numOrNull(v) == null ? null : Math.round(Number(v)));

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
    const where = { ...tenantScope(req) };
    if (req.query.vehicleId) where.vehicleId = String(req.query.vehicleId);
    const items = await prisma.maintenanceRecord.findMany({
      where,
      include: { vehicle: { select: { id: true, plateNumber: true, odometerBaseKm: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const odometers = new Map();
    for (const i of items) {
      if (!odometers.has(i.vehicle.id)) odometers.set(i.vehicle.id, await currentOdometerKm(i.vehicle));
    }
    let vehicleOdometerKm = null;
    if (req.query.vehicleId) {
      const v = await prisma.vehicle.findFirst({
        where: { id: String(req.query.vehicleId), ...tenantScope(req) },
        select: { id: true, odometerBaseKm: true },
      });
      if (v) vehicleOdometerKm = await currentOdometerKm(v);
    }

    return res.json({
      odometerKm: vehicleOdometerKm,
      items: items.map((i) => ({ ...toApi(i), state: reminderState(i, odometers.get(i.vehicle.id) ?? 0) })),
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
    const vehicle = await prisma.vehicle.findFirst({ where: { id: String(vehicleId ?? ""), ...tenantScope(req) } });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const doc = {
      companyId: vehicle.companyId,
      vehicleId: vehicle.id,
      kind,
      title: title.trim(),
      notes: req.body.notes ? String(req.body.notes) : null,
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
      const intervalDays = intOrNull(req.body.intervalDays);
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
    const item = await prisma.maintenanceRecord.create({ data: doc });
    return res.status(201).json(toApi(item));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save maintenance" });
  }
}

export async function updateMaintenance(req, res) {
  try {
    const item = await prisma.maintenanceRecord.findFirst({ where: { id: req.params.id, ...tenantScope(req) }, select: { id: true } });
    if (!item) return res.status(404).json({ error: "Not found" });
    const data = {};
    if ("title" in req.body) data.title = String(req.body.title);
    if ("notes" in req.body) data.notes = req.body.notes == null ? null : String(req.body.notes);
    for (const f of ["odometerKm", "costKes", "dueOdometerKm", "intervalKm"]) if (f in req.body) data[f] = numOrNull(req.body[f]);
    if ("intervalDays" in req.body) data.intervalDays = intOrNull(req.body.intervalDays);
    for (const f of ["performedAt", "dueDate"]) if (f in req.body) data[f] = dateOrNull(req.body[f]);
    if ("dueDate" in req.body || "dueOdometerKm" in req.body) data.alertedAt = null;
    const updated = await prisma.maintenanceRecord.update({ where: { id: item.id }, data });
    return res.json(toApi(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update maintenance" });
  }
}

export async function deleteMaintenance(req, res) {
  try {
    const { count } = await prisma.maintenanceRecord.deleteMany({ where: { id: req.params.id, ...tenantScope(req) } });
    if (!count) return res.status(404).json({ error: "Not found" });
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
    const reminder = await prisma.maintenanceRecord.findFirst({
      where: { id: req.params.id, kind: "reminder", ...tenantScope(req) },
      include: { vehicle: { select: { id: true, odometerBaseKm: true } } },
    });
    if (!reminder) return res.status(404).json({ error: "Reminder not found" });
    if (reminder.status === "done") return res.status(400).json({ error: "Already completed" });
    const odometerKm = await currentOdometerKm(reminder.vehicle);

    const recordOdometerKm = numOrNull(req.body.odometerKm) ?? odometerKm;
    // Close the reminder, log the service and schedule the next one together.
    const [, record, next] = await prisma.$transaction([
      prisma.maintenanceRecord.update({ where: { id: reminder.id }, data: { status: "done" } }),
      prisma.maintenanceRecord.create({
        data: {
          companyId: reminder.companyId,
          vehicleId: reminder.vehicleId,
          kind: "record",
          title: reminder.title,
          notes: req.body.notes ? String(req.body.notes) : reminder.notes,
          performedAt: new Date(),
          odometerKm: recordOdometerKm,
          costKes: numOrNull(req.body.costKes),
          status: "done",
        },
      }),
      ...(reminder.intervalDays || reminder.intervalKm
        ? [
            prisma.maintenanceRecord.create({
              data: {
                companyId: reminder.companyId,
                vehicleId: reminder.vehicleId,
                kind: "reminder",
                title: reminder.title,
                notes: reminder.notes,
                intervalDays: reminder.intervalDays,
                intervalKm: reminder.intervalKm,
                dueDate: reminder.intervalDays ? new Date(Date.now() + reminder.intervalDays * 86400000) : null,
                dueOdometerKm: reminder.intervalKm ? recordOdometerKm + reminder.intervalKm : null,
              },
            }),
          ]
        : []),
    ]);
    return res.json({ record: toApi(record), next: next ? toApi(next) : null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to complete reminder" });
  }
}

// Scheduled (index.js) — one maintenance_due alert per reminder once it's
// due by date or odometer.
export async function sweepMaintenanceReminders() {
  const reminders = await prisma.maintenanceRecord.findMany({
    where: { kind: "reminder", status: "open", alertedAt: null },
    include: { vehicle: { select: { id: true, plateNumber: true, odometerBaseKm: true } } },
  });
  let alerted = 0;
  for (const r of reminders) {
    const { vehicle } = r;
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
    await prisma.maintenanceRecord.update({ where: { id: r.id }, data: { alertedAt: new Date() } });
    alerted += 1;
  }
  return alerted;
}
