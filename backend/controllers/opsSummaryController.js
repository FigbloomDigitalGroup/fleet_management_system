import mongoose from "mongoose";
import Job from "../models/Job.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Inspection from "../models/Inspection.js";
import Message from "../models/Message.js";
import MaintenanceRecord from "../models/MaintenanceRecord.js";
import LocationPing from "../models/LocationPing.js";
import { tenantScope } from "../middleware/auth.js";
import { computeDriverScores } from "../lib/driverScore.js";
import { getCompanySettings } from "../lib/companySettings.js";
import { isLate } from "./jobController.js";
import { currentOdometerKm } from "./maintenanceController.js";

const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

// Start of today in Nairobi (UTC+3, no DST) as a real Date.
function startOfNairobiToday() {
  return new Date(`${todayKey()}T00:00:00+03:00`);
}

// ADMIN/COMPANY_OWNER — the operational numbers for the dashboard in one
// call: today's jobs, fleet safety, inspections, maintenance, phone health
// and unread driver messages.
export async function getOpsSummary(req, res) {
  try {
    const scope = tenantScope(req);
    const companyId = scope.companyId ? new mongoose.Types.ObjectId(String(scope.companyId)) : null;
    const since = startOfNairobiToday();

    const [jobs, drivers, vehicles, inspections, unreadMessages, oldestUnread, reminders] = await Promise.all([
      Job.find({ ...scope, scheduledDate: todayKey(), status: { $ne: "cancelled" } }).select("status windowEnd completedAt").lean(),
      User.find({ role: "DRIVER", ...scope }).select("_id"),
      Vehicle.find(scope).select("device odometerBaseKm driverId status"),
      Inspection.find({ ...scope, createdAt: { $gte: since } }).select("passed vehicleId").lean(),
      Message.countDocuments({ ...(companyId ? { companyId } : {}), fromDriver: true, readAt: null }),
      Message.findOne({ ...(companyId ? { companyId } : {}), fromDriver: true, readAt: null })
        .sort({ createdAt: 1 })
        .select("createdAt")
        .lean(),
      MaintenanceRecord.find({ ...scope, kind: "reminder", status: "open" }).populate("vehicleId", "odometerBaseKm").lean(),
    ]);

    // Fleet safety: average of the drivers who have a score yet, plus the
    // same 30-day average as it stood a week ago, for the trend arrow.
    const driverIds = drivers.map((d) => d._id);
    const [scoreMap, lastWeekMap] = driverIds.length
      ? await Promise.all([
          computeDriverScores(driverIds, 30),
          computeDriverScores(driverIds, 30, new Date(Date.now() - 7 * 86400000)),
        ])
      : [new Map(), new Map()];
    const averageOf = (map) => {
      const scored = [...map.values()].filter((s) => s.score !== null);
      return { avg: scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : null, count: scored.length };
    };
    const { avg: avgScore, count: scoredDrivers } = averageOf(scoreMap);
    const { avg: lastWeekScore } = averageOf(lastWeekMap);
    const incidents = [...scoreMap.values()].reduce((a, s) => a + s.totalEvents, 0);

    // Inspection coverage: every vehicle with a driver that isn't in the
    // workshop should get a pre-trip check today.
    const expectedVehicles = vehicles.filter((v) => v.driverId && v.status !== "maintenance");
    const inspectedIds = new Set(inspections.map((i) => String(i.vehicleId)));
    const inspectedVehicles = expectedVehicles.filter((v) => inspectedIds.has(String(v._id))).length;

    // Maintenance due state, same rules as the vehicle page.
    let overdue = 0;
    let dueSoon = 0;
    const odometers = new Map();
    for (const r of reminders) {
      if (!r.vehicleId) continue;
      const key = String(r.vehicleId._id);
      if (!odometers.has(key)) odometers.set(key, await currentOdometerKm(r.vehicleId));
      const odo = odometers.get(key);
      const now = Date.now();
      const isOverdue = (r.dueDate && new Date(r.dueDate) <= now) || (r.dueOdometerKm != null && odo >= r.dueOdometerKm);
      const isSoon =
        (r.dueDate && new Date(r.dueDate) <= now + 7 * 86400000) || (r.dueOdometerKm != null && odo >= r.dueOdometerKm - 500);
      if (isOverdue) overdue += 1;
      else if (isSoon) dueSoon += 1;
    }

    // Phone health across vehicles that have reported from a phone.
    const lowBatteryPercent = companyId ? (await getCompanySettings(companyId)).alertSettings.lowBatteryPercent : 15;
    const phones = vehicles.filter((v) => v.device?.lastSeenAt);
    const sharing = phones.filter((v) => v.device.isSharing && !v.device.offlineAlertedAt).length;
    const lowBattery = phones.filter(
      (v) => v.device.batteryLevel != null && !v.device.isCharging && v.device.batteryLevel * 100 <= lowBatteryPercent
    ).length;
    const silent = phones.filter((v) => v.device.offlineAlertedAt).length;
    const mockedToday = await LocationPing.distinct("vehicleId", {
      vehicleId: { $in: vehicles.map((v) => v._id) },
      isMocked: true,
      recordedAt: { $gte: since },
    });

    return res.json({
      jobsToday: {
        total: jobs.length,
        completed: jobs.filter((j) => j.status === "completed").length,
        inProgress: jobs.filter((j) => ["started", "arrived"].includes(j.status)).length,
        pending: jobs.filter((j) => j.status === "assigned").length,
        failed: jobs.filter((j) => j.status === "failed").length,
        late: jobs.filter((j) => isLate(j)).length,
      },
      safety: { avgScore, lastWeekScore, scoredDrivers, totalDrivers: drivers.length, incidents30d: incidents },
      inspectionsToday: {
        total: inspections.length,
        failed: inspections.filter((i) => !i.passed).length,
        inspectedVehicles,
        expectedVehicles: expectedVehicles.length,
      },
      maintenance: { overdue, dueSoon },
      phones: { reporting: phones.length, sharing, lowBattery, offline: silent, fakeGpsToday: mockedToday.length },
      unreadMessages,
      oldestUnreadAt: oldestUnread?.createdAt ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load operations summary" });
  }
}




