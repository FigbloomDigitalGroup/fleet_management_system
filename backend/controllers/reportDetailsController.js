import ExcelJS from "exceljs";
import prisma from "../lib/prisma.js";
import { tenantScope } from "../middleware/auth.js";
import { toApi } from "../lib/serialize.js";
import { computeDriverScores, gradeFor } from "../lib/driverScore.js";
import { currentOdometerKm, reminderState } from "./maintenanceController.js";
import { parseRange, dateKey } from "./reportController.js";

// The Reports page beyond the summary table: headline metrics with daily
// graphs, the top drivers, and five detail reports (fuel, safety,
// geofences, maintenance, trips) — each also downloadable as Excel.

const MAX_TRIP_ROWS = 1000;
const MAX_EVENT_ROWS = 500;
const TOP_DRIVERS = 3;
const MAX_PLAUSIBLE_L_PER_100KM = 100;

const round1 = (n) => Math.round((n || 0) * 10) / 10;
const pctChange = (now, before) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);

async function scopedVehicles(req) {
  return prisma.vehicle.findMany({
    where: tenantScope(req),
    select: { id: true, plateNumber: true, avgConsumptionLPer100Km: true, odometerBaseKm: true },
    orderBy: { createdAt: "asc" },
  });
}

// Every day in the range as "YYYY-MM-DD" (Nairobi), oldest first.
function daysIn({ from, to }) {
  const keys = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
    const k = dateKey(new Date(t));
    if (keys[keys.length - 1] !== k) keys.push(k);
  }
  const last = dateKey(to);
  if (keys[keys.length - 1] !== last) keys.push(last);
  return keys;
}

async function periodTotals(vehicleIds, scope, from, to) {
  const [trips, expenses, fuel] = await Promise.all([
    prisma.trip.aggregate({
      where: { vehicleId: { in: vehicleIds }, startTime: { gte: from, lte: to } },
      _count: true,
      _sum: { distanceKm: true },
    }),
    prisma.expense.aggregate({ where: { ...scope, incurredAt: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { ...scope, category: "fuel", incurredAt: { gte: from, lte: to } }, _sum: { amount: true } }),
  ]);
  return {
    trips: trips._count,
    distanceKm: round1(trips._sum.distanceKm),
    expensesKes: expenses._sum.amount || 0,
    fuelKes: fuel._sum.amount || 0,
  };
}

const averageScore = (scores) => {
  const list = [...scores.values()].map((s) => s.score).filter((s) => s != null);
  return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null;
};

// Headline metrics for the cards (with the previous period of the same
// length for the trend), one point per day for their graphs, and the
// best-scoring drivers.
async function buildOverview(req, range) {
  const scope = tenantScope(req);
  const { from, to } = range;
  const vehicleIds = (await scopedVehicles(req)).map((v) => v.id);
  const span = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - span);

  const [current, previous] = await Promise.all([
    periodTotals(vehicleIds, scope, from, to),
    periodTotals(vehicleIds, scope, prevFrom, from),
  ]);

  const days = daysIn(range);
  const daily = new Map(days.map((d) => [d, { date: d, distanceKm: 0, trips: 0, expensesKes: 0, fuelKes: 0 }]));
  const trips = await prisma.trip.findMany({
    where: { vehicleId: { in: vehicleIds }, startTime: { gte: from, lte: to } },
    select: { startTime: true, distanceKm: true, driverId: true },
  });
  for (const t of trips) {
    const d = daily.get(dateKey(t.startTime));
    if (!d) continue;
    d.trips += 1;
    d.distanceKm += t.distanceKm || 0;
  }
  const expenses = await prisma.expense.findMany({
    where: { ...scope, incurredAt: { gte: from, lte: to } },
    select: { incurredAt: true, amount: true, category: true },
  });
  for (const e of expenses) {
    const d = daily.get(dateKey(e.incurredAt));
    if (!d) continue;
    d.expensesKes += e.amount;
    if (e.category === "fuel") d.fuelKes += e.amount;
  }

  const drivers = await prisma.user.findMany({
    where: { role: "DRIVER", ...scope },
    select: { id: true, fullName: true, avatarUploadId: true },
  });
  const scoreDays = Math.max(7, Math.ceil(span / 86400000));
  const ids = drivers.map((d) => d.id);
  const [scores, prevScores] = ids.length
    ? await Promise.all([computeDriverScores(ids, scoreDays, to), computeDriverScores(ids, scoreDays, from)])
    : [new Map(), new Map()];

  const driven = new Map();
  for (const t of trips) {
    if (!t.driverId) continue;
    const r = driven.get(t.driverId) || { distanceKm: 0, trips: 0 };
    r.distanceKm += t.distanceKm || 0;
    r.trips += 1;
    driven.set(t.driverId, r);
  }
  const ranked = drivers
    .map((d) => {
      const s = scores.get(d.id);
      const r = driven.get(d.id) || { distanceKm: 0, trips: 0 };
      return {
        id: d.id,
        fullName: d.fullName,
        avatarUrl: toApi(d).avatarUrl ?? null,
        score: s?.score ?? null,
        grade: s?.grade ?? null,
        distanceKm: round1(r.distanceKm),
        trips: r.trips,
      };
    })
    // Best score first; unscored drivers after, busiest first.
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.distanceKm - a.distanceKm);

  const scoreBands = { Excellent: 0, Good: 0, Fair: 0, "Needs coaching": 0, "Not scored": 0 };
  for (const d of ranked) scoreBands[d.grade ?? "Not scored"] += 1;

  const avgScore = averageScore(scores);
  const prevAvgScore = averageScore(prevScores);
  return {
    from,
    to,
    metrics: {
      distanceKm: { value: current.distanceKm, change: pctChange(current.distanceKm, previous.distanceKm) },
      expensesKes: { value: current.expensesKes, fuelKes: current.fuelKes, change: pctChange(current.expensesKes, previous.expensesKes) },
      trips: { value: current.trips, change: pctChange(current.trips, previous.trips) },
      avgScore: {
        value: avgScore,
        grade: gradeFor(avgScore),
        change: avgScore != null && prevAvgScore != null ? avgScore - prevAvgScore : null,
      },
    },
    daily: [...daily.values()].map((d) => ({ ...d, distanceKm: round1(d.distanceKm) })),
    scoreBands,
    topDrivers: ranked.slice(0, TOP_DRIVERS),
    driverCount: drivers.length,
  };
}

// Fuel per vehicle: what was paid for fuel, and the litres the distance
// should have needed at the vehicle's rated consumption.
async function buildFuel(req, { from, to }) {
  const scope = tenantScope(req);
  const vehicles = await scopedVehicles(req);
  const rows = new Map(
    vehicles.map((v) => [
      v.id,
      { id: v.id, name: v.plateNumber, distanceKm: 0, ratedLPer100Km: v.avgConsumptionLPer100Km, estimatedLiters: 0, fuelKes: 0, fills: 0, kesPerKm: null },
    ])
  );
  const trips = await prisma.trip.groupBy({
    by: ["vehicleId"],
    where: { vehicleId: { in: vehicles.map((v) => v.id) }, startTime: { gte: from, lte: to } },
    _sum: { distanceKm: true },
  });
  for (const t of trips) {
    const r = rows.get(t.vehicleId);
    if (r) r.distanceKm = round1(t._sum.distanceKm);
  }
  const fuel = await prisma.expense.groupBy({
    by: ["vehicleId"],
    where: { ...scope, category: "fuel", incurredAt: { gte: from, lte: to } },
    _sum: { amount: true },
    _count: true,
  });
  for (const f of fuel) {
    const r = rows.get(f.vehicleId);
    if (!r) continue;
    r.fuelKes = f._sum.amount || 0;
    r.fills = f._count;
  }
  // A rating no road vehicle reaches is a typo in the vehicle's settings —
  // leave the estimate blank rather than report thousands of litres.
  const list = [...rows.values()].map((r) => ({
    ...r,
    ratedLPer100Km: r.ratedLPer100Km > 0 && r.ratedLPer100Km <= MAX_PLAUSIBLE_L_PER_100KM ? r.ratedLPer100Km : null,
  })).map((r) => ({
    ...r,
    estimatedLiters: r.ratedLPer100Km == null ? null : round1((r.distanceKm * r.ratedLPer100Km) / 100),
    kesPerKm: r.distanceKm > 0 && r.fuelKes > 0 ? round1(r.fuelKes / r.distanceKm) : null,
  }));
  const sum = (k) => list.reduce((a, r) => a + (r[k] || 0), 0);
  const totalKm = round1(sum("distanceKm"));
  const totalKes = sum("fuelKes");
  return {
    rows: list,
    totals: {
      distanceKm: totalKm,
      estimatedLiters: round1(sum("estimatedLiters")),
      fuelKes: totalKes,
      fills: sum("fills"),
      kesPerKm: totalKm > 0 && totalKes > 0 ? round1(totalKes / totalKm) : null,
    },
  };
}

const SAFETY_KEYS = ["speeding", "harsh_braking", "harsh_acceleration", "harsh_cornering", "phone_use"];

// Speeding and harsh driving per vehicle or driver (from the recorded
// driving events), the alerts raised in the range by type, and the latest
// speeding events.
async function buildSafety(req, { from, to }, groupBy) {
  const scope = tenantScope(req);
  const byDriver = groupBy === "driver";
  const subjects = byDriver
    ? await prisma.user.findMany({ where: { role: "DRIVER", ...scope }, select: { id: true, fullName: true }, orderBy: { createdAt: "asc" } })
    : await prisma.vehicle.findMany({ where: scope, select: { id: true, plateNumber: true }, orderBy: { createdAt: "asc" } });
  const empty = (s) => ({
    id: s.id,
    name: byDriver ? s.fullName : s.plateNumber,
    ...Object.fromEntries(SAFETY_KEYS.map((k) => [k, 0])),
    topSpeedKph: null,
    total: 0,
  });
  const rows = new Map(subjects.map((s) => [s.id, empty(s)]));

  const events = await prisma.drivingEvent.findMany({
    where: { ...scope, recordedAt: { gte: from, lte: to } },
    include: { vehicle: { select: { plateNumber: true } }, driver: { select: { fullName: true } } },
    orderBy: { recordedAt: "desc" },
  });
  for (const e of events) {
    const r = rows.get(byDriver ? e.driverId : e.vehicleId);
    if (!r) continue;
    r[e.type] += 1;
    r.total += 1;
    if (e.type === "speeding" && e.speedKph != null) r.topSpeedKph = Math.max(r.topSpeedKph ?? 0, Math.round(e.speedKph));
  }
  const list = [...rows.values()].sort((a, b) => b.total - a.total);
  const totals = Object.fromEntries(SAFETY_KEYS.map((k) => [k, list.reduce((a, r) => a + r[k], 0)]));
  totals.total = list.reduce((a, r) => a + r.total, 0);
  const speeds = list.map((r) => r.topSpeedKph).filter((s) => s != null);
  totals.topSpeedKph = speeds.length ? Math.max(...speeds) : null;

  const alertGroups = await prisma.alert.groupBy({
    by: ["type"],
    where: { ...scope, createdAt: { gte: from, lte: to } },
    _count: true,
  });
  const alertsByType = alertGroups.map((a) => ({ type: a.type, count: a._count })).sort((a, b) => b.count - a.count);

  const speeding = events
    .filter((e) => e.type === "speeding")
    .slice(0, MAX_EVENT_ROWS)
    .map((e) => ({
      id: e.id,
      recordedAt: e.recordedAt,
      vehicle: e.vehicle?.plateNumber ?? "—",
      driver: e.driver?.fullName ?? "—",
      speedKph: e.speedKph != null ? Math.round(e.speedKph) : null,
      latitude: e.latitude,
      longitude: e.longitude,
    }));

  return { groupBy: byDriver ? "driver" : "vehicle", rows: list, totals, alertsByType, speeding };
}

// Geofence visits: each entry paired with the exit that followed it, so
// the report reads "in at … out at … stayed …". A visit still open at the
// end of the range has no exit; an exit with no entry in range started
// before it.
async function buildGeofences(req, { from, to }) {
  const events = await prisma.geofenceEvent.findMany({
    where: { ...tenantScope(req), recordedAt: { gte: from, lte: to } },
    include: { vehicle: { select: { plateNumber: true } }, driver: { select: { fullName: true } } },
    orderBy: { recordedAt: "asc" },
  });
  const open = new Map();
  const visits = [];
  for (const e of events) {
    const key = `${e.vehicleId}|${e.geofenceId ?? e.geofenceName}`;
    if (e.kind === "enter") {
      const visit = {
        id: e.id,
        geofence: e.geofenceName,
        vehicle: e.vehicle?.plateNumber ?? "—",
        driver: e.driver?.fullName ?? "—",
        enteredAt: e.recordedAt,
        exitedAt: null,
        minutesInside: null,
      };
      visits.push(visit);
      open.set(key, visit);
    } else {
      const visit = open.get(key);
      if (visit) {
        visit.exitedAt = e.recordedAt;
        visit.minutesInside = Math.round((e.recordedAt - visit.enteredAt) / 60000);
        open.delete(key);
      } else {
        visits.push({
          id: e.id,
          geofence: e.geofenceName,
          vehicle: e.vehicle?.plateNumber ?? "—",
          driver: e.driver?.fullName ?? "—",
          enteredAt: null,
          exitedAt: e.recordedAt,
          minutesInside: null,
        });
      }
    }
  }
  const byZone = new Map();
  for (const e of events) {
    const z = byZone.get(e.geofenceName) || { geofence: e.geofenceName, entries: 0, exits: 0, vehicles: new Set() };
    z[e.kind === "enter" ? "entries" : "exits"] += 1;
    z.vehicles.add(e.vehicleId);
    byZone.set(e.geofenceName, z);
  }
  const firstEvent = await prisma.geofenceEvent.findFirst({
    where: tenantScope(req),
    orderBy: { recordedAt: "asc" },
    select: { recordedAt: true },
  });
  return {
    visits: visits.reverse().slice(0, MAX_EVENT_ROWS),
    zones: [...byZone.values()]
      .map((z) => ({ geofence: z.geofence, entries: z.entries, exits: z.exits, vehicles: z.vehicles.size }))
      .sort((a, b) => b.entries - a.entries),
    totals: { entries: events.filter((e) => e.kind === "enter").length, exits: events.filter((e) => e.kind === "exit").length },
    recordedSince: firstEvent?.recordedAt ?? null,
  };
}

const STATE_ORDER = { overdue: 0, due_soon: 1, upcoming: 2 };

// Open service reminders — overdue first — with how far off each is, plus
// what servicing cost in the range. Reminders don't depend on the range.
async function buildMaintenance(req, { from, to }) {
  const scope = tenantScope(req);
  const vehicles = await scopedVehicles(req);
  const odometers = new Map(await Promise.all(vehicles.map(async (v) => [v.id, await currentOdometerKm(v)])));
  const plates = new Map(vehicles.map((v) => [v.id, v.plateNumber]));
  const reminders = await prisma.maintenanceRecord.findMany({ where: { ...scope, kind: "reminder", status: "open" } });
  const now = Date.now();
  const rows = reminders
    .filter((r) => plates.has(r.vehicleId))
    .map((r) => {
      const odometerKm = odometers.get(r.vehicleId) ?? 0;
      return {
        id: r.id,
        vehicle: plates.get(r.vehicleId),
        title: r.title,
        state: reminderState(r, odometerKm),
        dueDate: r.dueDate,
        daysLeft: r.dueDate ? Math.ceil((new Date(r.dueDate).getTime() - now) / 86400000) : null,
        dueOdometerKm: r.dueOdometerKm,
        odometerKm,
        kmLeft: r.dueOdometerKm != null ? round1(r.dueOdometerKm - odometerKm) : null,
      };
    })
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));

  const done = await prisma.maintenanceRecord.aggregate({
    where: { ...scope, kind: "record", performedAt: { gte: from, lte: to } },
    _count: true,
    _sum: { costKes: true },
  });
  return {
    rows,
    totals: {
      overdue: rows.filter((r) => r.state === "overdue").length,
      dueSoon: rows.filter((r) => r.state === "due_soon").length,
      upcoming: rows.filter((r) => r.state === "upcoming").length,
      servicedInRange: done._count,
      serviceCostKes: done._sum.costKes || 0,
    },
  };
}

// Every trip that started in the range, newest first.
async function buildTrips(req, { from, to }) {
  const vehicles = await scopedVehicles(req);
  const trips = await prisma.trip.findMany({
    where: { vehicleId: { in: vehicles.map((v) => v.id) }, startTime: { gte: from, lte: to } },
    omit: { roadPath: true },
    include: { vehicle: { select: { plateNumber: true } }, driver: { select: { fullName: true } } },
    orderBy: { startTime: "desc" },
    take: MAX_TRIP_ROWS,
  });
  const rows = trips.map((t) => {
    const minutes = t.endTime ? Math.round((t.endTime - t.startTime) / 60000) : null;
    return {
      id: t.id,
      vehicle: t.vehicle?.plateNumber ?? "—",
      driver: t.driver?.fullName ?? "—",
      startTime: t.startTime,
      endTime: t.endTime,
      minutes,
      distanceKm: t.distanceKm != null ? round1(t.distanceKm) : null,
      avgSpeedKph: minutes && t.distanceKm ? Math.round(t.distanceKm / (minutes / 60)) : null,
      purpose: t.purpose ?? null,
    };
  });
  return {
    rows,
    truncated: trips.length === MAX_TRIP_ROWS,
    totals: {
      trips: rows.length,
      distanceKm: round1(rows.reduce((a, r) => a + (r.distanceKm || 0), 0)),
      minutes: rows.reduce((a, r) => a + (r.minutes || 0), 0),
    },
  };
}

const BUILDERS = {
  overview: buildOverview,
  fuel: buildFuel,
  safety: buildSafety,
  geofences: buildGeofences,
  maintenance: buildMaintenance,
  trips: buildTrips,
};

// ADMIN/COMPANY_OWNER — GET /api/reports/:kind (?from&to[&groupBy])
export function getDetailReport(kind) {
  return async (req, res) => {
    try {
      const range = parseRange(req);
      if (range.error) return res.status(400).json({ error: range.error });
      return res.json(await BUILDERS[kind](req, range, req.query.groupBy));
    } catch (err) {
      console.error(`[report:${kind}]`, err);
      return res.status(500).json({ error: "Failed to build report" });
    }
  };
}

const at = (d) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" }) : "—");
const orDash = (v) => (v == null ? "—" : v);

// Sheets for the Excel download — one per report, in the page's column order.
const SHEETS = {
  fuel: (r) => ({
    title: "Fuel usage",
    columns: [
      ["Vehicle", "name", 18],
      ["Distance (km)", "distanceKm"],
      ["Rated L/100 km", "ratedLPer100Km"],
      ["Estimated litres", "estimatedLiters"],
      ["Fuel bought (KES)", "fuelKes"],
      ["Fill-ups", "fills"],
      ["KES per km", "kesPerKm"],
    ],
    rows: r.rows.map((x) => ({
      ...x,
      ratedLPer100Km: orDash(x.ratedLPer100Km),
      estimatedLiters: orDash(x.estimatedLiters),
      kesPerKm: orDash(x.kesPerKm),
    })),
    total: { name: "Total", ...r.totals, kesPerKm: orDash(r.totals.kesPerKm) },
  }),
  safety: (r) => ({
    title: "Speeding & safety",
    columns: [
      [r.groupBy === "driver" ? "Driver" : "Vehicle", "name", 22],
      ["Speeding", "speeding"],
      ["Top speed (km/h)", "topSpeedKph"],
      ["Harsh braking", "harsh_braking"],
      ["Harsh acceleration", "harsh_acceleration"],
      ["Harsh cornering", "harsh_cornering"],
      ["Phone use", "phone_use"],
      ["Total events", "total"],
    ],
    rows: r.rows.map((x) => ({ ...x, topSpeedKph: orDash(x.topSpeedKph) })),
    total: { name: "Total", ...r.totals, topSpeedKph: orDash(r.totals.topSpeedKph) },
  }),
  geofences: (r) => ({
    title: "Geofence visits",
    columns: [
      ["Geofence", "geofence", 22],
      ["Vehicle", "vehicle", 14],
      ["Driver", "driver", 20],
      ["Entered", "enteredAt", 20],
      ["Exited", "exitedAt", 20],
      ["Minutes inside", "minutesInside"],
    ],
    rows: r.visits.map((v) => ({ ...v, enteredAt: at(v.enteredAt), exitedAt: at(v.exitedAt), minutesInside: orDash(v.minutesInside) })),
  }),
  maintenance: (r) => ({
    title: "Maintenance due",
    columns: [
      ["Vehicle", "vehicle", 14],
      ["Service", "title", 26],
      ["Status", "state", 12],
      ["Due date", "dueDate", 14],
      ["Days left", "daysLeft"],
      ["Due at (km)", "dueOdometerKm"],
      ["Odometer (km)", "odometerKm"],
      ["Km left", "kmLeft"],
    ],
    rows: r.rows.map((x) => ({
      ...x,
      state: x.state.replace("_", " "),
      dueDate: x.dueDate ? dateKey(new Date(x.dueDate)) : "—",
      daysLeft: orDash(x.daysLeft),
      dueOdometerKm: orDash(x.dueOdometerKm),
      kmLeft: orDash(x.kmLeft),
    })),
  }),
  trips: (r) => ({
    title: "Trips",
    columns: [
      ["Vehicle", "vehicle", 14],
      ["Driver", "driver", 20],
      ["Start", "startTime", 20],
      ["End", "endTime", 20],
      ["Minutes", "minutes"],
      ["Distance (km)", "distanceKm"],
      ["Avg speed (km/h)", "avgSpeedKph"],
      ["Purpose", "purpose"],
    ],
    rows: r.rows.map((x) => ({
      ...x,
      startTime: at(x.startTime),
      endTime: x.endTime ? at(x.endTime) : "In progress",
      minutes: orDash(x.minutes),
      distanceKm: orDash(x.distanceKm),
      avgSpeedKph: orDash(x.avgSpeedKph),
      purpose: orDash(x.purpose),
    })),
    total: { vehicle: "Total", ...r.totals, startTime: "", endTime: "", avgSpeedKph: "", purpose: "" },
  }),
};

// ADMIN/COMPANY_OWNER — GET /api/reports/:kind.xlsx — the same report as Excel.
export function downloadDetailReport(kind) {
  return async (req, res) => {
    try {
      const range = parseRange(req);
      if (range.error) return res.status(400).json({ error: range.error });
      const sheetDef = SHEETS[kind](await BUILDERS[kind](req, range, req.query.groupBy));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FIGBLOOM FLEET";
      const sheet = workbook.addWorksheet(sheetDef.title);
      sheet.columns = sheetDef.columns.map(([header, key, width]) => ({ header, key, width: width ?? 16 }));
      sheet.getRow(1).font = { bold: true };
      sheetDef.rows.forEach((r) => sheet.addRow(r));
      if (sheetDef.total) sheet.addRow(sheetDef.total).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];

      const name = `fleet-${kind}-report-${dateKey(range.from)}-to-${dateKey(range.to)}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error(`[report:${kind}.xlsx]`, err);
      return res.status(500).json({ error: "Failed to build report" });
    }
  };
}
