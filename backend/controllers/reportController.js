import ExcelJS from "exceljs";
import Trip from "../models/Trip.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import Job from "../models/Job.js";
import Expense from "../models/Expense.js";
import Inspection from "../models/Inspection.js";
import LocationPing from "../models/LocationPing.js";
import { tenantScope } from "../middleware/auth.js";
import { analyzePings } from "../lib/stops.js";
import { computeDriverScores } from "../lib/driverScore.js";
import { isLate } from "./jobController.js";

const MAX_RANGE_DAYS = 93;
const MAX_PINGS_PER_TRIP = 5000;

const dateKey = (d) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

function parseRange(req) {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 7 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return { error: "from must be before to" };
  if (to - from > MAX_RANGE_DAYS * 86400000) return { error: `Pick a range of ${MAX_RANGE_DAYS} days or less` };
  return { from, to };
}

const emptyRow = (id, name) => ({
  id,
  name,
  trips: 0,
  distanceKm: 0,
  drivingHours: 0,
  idleMinutes: 0,
  stops: 0,
  jobsCompleted: 0,
  jobsLate: 0,
  jobsFailed: 0,
  expensesKes: 0,
  inspections: 0,
  inspectionsFailed: 0,
  score: null,
});

// Builds the report rows — one per vehicle or per driver — for the range.
// Stops and idle time are measured inside recorded trips (engine-on time).
async function buildReport(req, { from, to }, groupBy) {
  const scope = tenantScope(req);
  const byDriver = groupBy === "driver";
  const subjects = byDriver
    ? await User.find({ role: "DRIVER", ...scope }).select("fullName")
    : await Vehicle.find(scope).select("plateNumber");
  const rows = new Map(subjects.map((s) => [String(s._id), emptyRow(String(s._id), byDriver ? s.fullName : s.plateNumber)]));
  const vehicleIds = byDriver ? (await Vehicle.find(scope).select("_id")).map((v) => v._id) : subjects.map((s) => s._id);
  const keyOf = (doc) => String(byDriver ? doc.driverId : doc.vehicleId);

  const trips = await Trip.find({ vehicleId: { $in: vehicleIds }, startTime: { $gte: from, $lte: to } }).lean();
  for (const trip of trips) {
    const row = rows.get(keyOf(trip));
    if (!row) continue;
    const end = trip.endTime || new Date();
    row.trips += 1;
    row.distanceKm += trip.distanceKm || 0;
    row.drivingHours += (end - new Date(trip.startTime)) / 3600000;
    const pings = await LocationPing.find({ vehicleId: trip.vehicleId, recordedAt: { $gte: trip.startTime, $lte: end } })
      .select("latitude longitude speedKph recordedAt")
      .sort({ recordedAt: 1 })
      .limit(MAX_PINGS_PER_TRIP)
      .lean();
    const analysis = analyzePings(pings);
    row.idleMinutes += analysis.idleMinutes;
    row.stops += analysis.stops.length;
  }

  const jobs = await Job.find({ ...scope, scheduledDate: { $gte: dateKey(from), $lte: dateKey(to) } }).lean();
  for (const job of jobs) {
    const row = rows.get(keyOf(job));
    if (!row) continue;
    if (job.status === "completed") {
      row.jobsCompleted += 1;
      if (isLate(job)) row.jobsLate += 1;
    }
    if (job.status === "failed") row.jobsFailed += 1;
  }

  const expenses = await Expense.find({ ...scope, incurredAt: { $gte: from, $lte: to } }).lean();
  for (const e of expenses) {
    const row = rows.get(keyOf(e));
    if (row) row.expensesKes += e.amount;
  }

  const inspections = await Inspection.find({ ...scope, createdAt: { $gte: from, $lte: to } }).lean();
  for (const i of inspections) {
    const row = rows.get(keyOf(i));
    if (!row) continue;
    row.inspections += 1;
    if (!i.passed) row.inspectionsFailed += 1;
  }

  if (byDriver && subjects.length) {
    const days = Math.max(7, Math.ceil((to - from) / 86400000));
    const scores = await computeDriverScores(subjects.map((s) => s._id), days);
    for (const [id, s] of scores) if (rows.has(id)) rows.get(id).score = s.score;
  }

  const list = [...rows.values()].map((r) => ({
    ...r,
    distanceKm: Math.round(r.distanceKm * 10) / 10,
    drivingHours: Math.round(r.drivingHours * 10) / 10,
  }));
  const sum = (k) => list.reduce((a, r) => a + (r[k] || 0), 0);
  const totals = {
    trips: sum("trips"),
    distanceKm: Math.round(sum("distanceKm") * 10) / 10,
    drivingHours: Math.round(sum("drivingHours") * 10) / 10,
    idleMinutes: sum("idleMinutes"),
    stops: sum("stops"),
    jobsCompleted: sum("jobsCompleted"),
    jobsLate: sum("jobsLate"),
    jobsFailed: sum("jobsFailed"),
    expensesKes: sum("expensesKes"),
    inspections: sum("inspections"),
    inspectionsFailed: sum("inspectionsFailed"),
  };
  return { from, to, groupBy: byDriver ? "driver" : "vehicle", rows: list, totals };
}

// ADMIN/COMPANY_OWNER — summary report as JSON (?from&to&groupBy=vehicle|driver)
export async function getSummaryReport(req, res) {
  try {
    const range = parseRange(req);
    if (range.error) return res.status(400).json({ error: range.error });
    return res.json(await buildReport(req, range, req.query.groupBy));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to build report" });
  }
}

const COLUMNS = [
  { header: "Trips", key: "trips" },
  { header: "Distance (km)", key: "distanceKm" },
  { header: "Driving hours", key: "drivingHours" },
  { header: "Idle (min)", key: "idleMinutes" },
  { header: "Stops", key: "stops" },
  { header: "Jobs completed", key: "jobsCompleted" },
  { header: "Late deliveries", key: "jobsLate" },
  { header: "Jobs failed", key: "jobsFailed" },
  { header: "Expenses (KES)", key: "expensesKes" },
  { header: "Inspections", key: "inspections" },
  { header: "Failed inspections", key: "inspectionsFailed" },
];

// Same report as an Excel workbook download
export async function downloadSummaryReport(req, res) {
  try {
    const range = parseRange(req);
    if (range.error) return res.status(400).json({ error: range.error });
    const report = await buildReport(req, range, req.query.groupBy);
    const byDriver = report.groupBy === "driver";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "FIGBLOOM FLEET";
    const sheet = workbook.addWorksheet("Summary");
    sheet.columns = [
      { header: byDriver ? "Driver" : "Vehicle", key: "name", width: 24 },
      ...COLUMNS.map((c) => ({ ...c, width: 16 })),
      ...(byDriver ? [{ header: "Safety score", key: "score", width: 14 }] : []),
    ];
    sheet.getRow(1).font = { bold: true };
    report.rows.forEach((r) => sheet.addRow({ ...r, score: r.score ?? "—" }));
    const totalRow = sheet.addRow({ name: "Total", ...report.totals });
    totalRow.font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const name = `fleet-report-${report.groupBy}-${dateKey(range.from)}-to-${dateKey(range.to)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to build report" });
  }
}
