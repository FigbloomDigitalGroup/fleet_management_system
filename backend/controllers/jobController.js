import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { raiseAlert } from "../lib/alerts.js";
import { getDrivingPathThrough, getPlaceLocation } from "../services/googleMapsService.js";
import { routeThrough } from "../services/mapMatching.js";
import { optimizeStops, driveMinutes } from "../lib/routeOptimizer.js";
import { distanceKm } from "../lib/geo.js";
import { ownedUploadIds, uploadUrl } from "./uploadController.js";

const OPEN_STATUSES = ["assigned", "started", "arrived"];
const NEXT_STATUS = {
  assigned: ["started", "failed"],
  started: ["arrived", "failed"],
  arrived: ["completed", "failed"],
};
const EDITABLE_FIELDS = ["title", "address", "contactName", "contactPhone", "notes", "scheduledDate", "windowStart", "windowEnd", "sequence"];

const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const isDateKey = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

const JOB_STATUSES = ["assigned", "started", "arrived", "completed", "failed", "cancelled"];

// Highest sequence among a driver's jobs on a day (0 when none), optionally
// ignoring one job.
async function lastSequenceFor(driverId, scheduledDate, exceptId) {
  const last = await prisma.job.findFirst({
    where: { driverId, scheduledDate, ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  return last?.sequence ?? 0;
}

export function isLate(job) {
  return !!(job.windowEnd && job.completedAt && new Date(job.completedAt) > new Date(job.windowEnd));
}

// What the Mongo version populated on the dashboard's job lists.
const LIST_INCLUDE = {
  driver: { select: { id: true, fullName: true, avatarUploadId: true } },
  vehicle: { select: { id: true, plateNumber: true } },
};

// Drivers without a job sort first, as Mongo sorted nulls.
const LIST_ORDER = [{ driverId: { sort: "asc", nulls: "first" } }, { sequence: "asc" }, { createdAt: "asc" }];

function present(job) {
  const o = toApi(job);
  return {
    ...o,
    late: isLate(o),
    trackingPath: `/track/${o.trackingToken}`,
    proof: o.proof
      ? {
          ...o.proof,
          photoUrls: (o.proof.photoUploadIds || []).map(uploadUrl),
          signatureUrl: uploadUrl(o.proof.signatureUploadId),
        }
      : null,
  };
}

// The road line through a run of stops: Google Directions when the server
// key is set, else OSRM (free), else straight lines between the stops so
// the order still shows.
async function drawRun(stops) {
  if (stops.length < 2) return { path: stops, distanceKm: 0, durationMin: 0, source: "straight" };
  const google = await getDrivingPathThrough(stops);
  if (!google.error && google.path.length > 1) return { ...google, source: "google" };
  try {
    return { ...(await routeThrough(stops)), source: "osrm" };
  } catch (err) {
    console.warn(`[jobs] road route unavailable, drawing straight lines: ${google.error}; ${err.message}`);
    return { path: stops, distanceKm: null, durationMin: null, source: "straight" };
  }
}

// A driver's saved line no longer matches once their stops for that day
// change; it's removed until the next optimize.
async function clearJobRoutes(...runs) {
  const where = runs.filter((r) => r.driverId && r.scheduledDate).map(({ driverId, scheduledDate }) => ({ driverId, scheduledDate }));
  if (where.length) await prisma.jobRoute.deleteMany({ where: { OR: where } });
}

// How fresh and how close the vehicle's last position must be to start the
// optimized run from it.
const START_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const START_MAX_KM = 150;

// Fields whose change moves a stop or reorders the run.
const ROUTE_FIELDS = ["address", "latitude", "longitude", "driverId", "scheduledDate", "sequence", "status"];

async function resolveDriverAndVehicle(req, driverId) {
  if (!driverId) return { driverId: null, vehicleId: null };
  const driver = await prisma.user.findFirst({
    where: { id: String(driverId), role: "DRIVER", ...tenantScope(req) },
    select: { id: true, companyId: true },
  });
  if (!driver) return { error: "Driver not found" };
  const vehicle = await prisma.vehicle.findFirst({ where: { driverId: driver.id }, select: { id: true } });
  return { driverId: driver.id, vehicleId: vehicle?.id ?? null, companyId: driver.companyId };
}

// ADMIN/COMPANY_OWNER — jobs for a day (default today), optionally one driver/status
export async function listJobs(req, res) {
  try {
    const where = { ...tenantScope(req) };
    if (isDateKey(req.query.date)) where.scheduledDate = req.query.date;
    else if (!req.query.from) where.scheduledDate = todayKey();
    if (isDateKey(req.query.from) && isDateKey(req.query.to)) where.scheduledDate = { gte: req.query.from, lte: req.query.to };
    if (req.query.driverId) where.driverId = String(req.query.driverId);
    if (req.query.status) {
      if (!JOB_STATUSES.includes(req.query.status)) return res.json([]);
      where.status = req.query.status;
    }
    const jobs = await prisma.job.findMany({ where, include: LIST_INCLUDE, orderBy: LIST_ORDER, take: 1000 });
    return res.json(jobs.map(present));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
}

export async function getJob(req, res) {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, ...tenantScope(req) },
      include: {
        driver: { select: { id: true, fullName: true, phone: true, avatarUploadId: true } },
        vehicle: LIST_INCLUDE.vehicle,
      },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(present(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
}

// ADMIN/COMPANY_OWNER (incl. dispatcher) — create a job. Coordinates are
// optional: when missing, the address is looked up on Google Maps.
export async function createJob(req, res) {
  try {
    const { title, address, driverId } = req.body;
    if (!title?.trim() || !address?.trim()) return res.status(400).json({ error: "title and address are required" });

    let latitude = Number(req.body.latitude);
    let longitude = Number(req.body.longitude);
    let resolvedAddress = address.trim();
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      const place = await getPlaceLocation(resolvedAddress);
      if (place.error) return res.status(400).json({ error: `Couldn't find that address: ${place.error}` });
      latitude = place.lat;
      longitude = place.lng;
    }

    const assignment = await resolveDriverAndVehicle(req, driverId);
    if (assignment.error) return res.status(404).json({ error: assignment.error });
    const companyId = req.user.role === "PLATFORM_ADMIN" ? assignment.companyId || req.body.companyId : req.user.companyId;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });

    const scheduledDate = isDateKey(req.body.scheduledDate) ? req.body.scheduledDate : todayKey();
    const lastSequence = assignment.driverId ? await lastSequenceFor(assignment.driverId, scheduledDate) : 0;

    const job = await prisma.job.create({
      data: {
        companyId: String(companyId),
        driverId: assignment.driverId,
        vehicleId: assignment.vehicleId,
        title: title.trim(),
        address: resolvedAddress,
        latitude,
        longitude,
        contactName: req.body.contactName || null,
        contactPhone: req.body.contactPhone || null,
        notes: req.body.notes || null,
        scheduledDate,
        windowStart: req.body.windowStart ? new Date(req.body.windowStart) : null,
        windowEnd: req.body.windowEnd ? new Date(req.body.windowEnd) : null,
        sequence: lastSequence + 1,
        trackingToken: crypto.randomBytes(18).toString("hex"),
        createdById: req.user.id,
      },
    });
    await clearJobRoutes(job);
    return res.status(201).json(present(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create job" });
  }
}

export async function updateJob(req, res) {
  try {
    const job = await prisma.job.findFirst({ where: { id: req.params.id, ...tenantScope(req) } });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const data = {};
    for (const field of EDITABLE_FIELDS) {
      if (!(field in req.body)) continue;
      const value = req.body[field];
      if (field === "windowStart" || field === "windowEnd") data[field] = value ? new Date(value) : null;
      else if (field === "scheduledDate") {
        if (isDateKey(value)) data.scheduledDate = value;
      } else if (field === "sequence") data.sequence = Math.round(Number(value)) || 0;
      else if (field === "title" || field === "address") data[field] = String(value);
      else data[field] = value == null || value === "" ? null : String(value);
    }
    if ("latitude" in req.body && "longitude" in req.body) {
      data.latitude = Number(req.body.latitude);
      data.longitude = Number(req.body.longitude);
    } else if ("address" in req.body) {
      const place = await getPlaceLocation(data.address);
      if (place.error) return res.status(400).json({ error: `Couldn't find that address: ${place.error}` });
      data.latitude = place.lat;
      data.longitude = place.lng;
    }
    if ("driverId" in req.body) {
      const assignment = await resolveDriverAndVehicle(req, req.body.driverId);
      if (assignment.error) return res.status(404).json({ error: assignment.error });
      data.driverId = assignment.driverId;
      data.vehicleId = assignment.vehicleId;
    }
    if (req.body.status === "cancelled" && OPEN_STATUSES.includes(job.status)) data.status = "cancelled";
    // Moved to another driver or day without an explicit position: put it
    // at the end of that list rather than colliding with an existing stop.
    const driverId = "driverId" in data ? data.driverId : job.driverId;
    const scheduledDate = data.scheduledDate ?? job.scheduledDate;
    const moved = driverId !== job.driverId || scheduledDate !== job.scheduledDate;
    if (moved && !("sequence" in req.body) && driverId) {
      data.sequence = (await lastSequenceFor(driverId, scheduledDate, job.id)) + 1;
    }
    const updated = await prisma.job.update({ where: { id: job.id }, data });
    if (ROUTE_FIELDS.some((field) => field in data)) await clearJobRoutes(job, updated);
    return res.json(present(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update job" });
  }
}

export async function deleteJob(req, res) {
  try {
    const job = await prisma.job.findFirst({ where: { id: req.params.id, ...tenantScope(req) } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    await prisma.job.delete({ where: { id: job.id } });
    await clearJobRoutes(job);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete job" });
  }
}

// ADMIN/COMPANY_OWNER — reorder one driver's open jobs for a day into the
// most efficient sequence, starting from their vehicle's last known
// position (or the first job, if it has never reported one).
export async function optimizeJobs(req, res) {
  try {
    const assignment = await resolveDriverAndVehicle(req, req.body.driverId);
    if (assignment.error || !assignment.driverId) return res.status(404).json({ error: "Driver not found" });
    const scheduledDate = isDateKey(req.body.date) ? req.body.date : todayKey();

    const jobs = await prisma.job.findMany({
      where: { driverId: assignment.driverId, scheduledDate, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: "asc" },
    });
    if (jobs.length === 0) {
      await clearJobRoutes({ driverId: assignment.driverId, scheduledDate });
      return res.json({ jobs: [], distanceKm: 0, lateMinutes: 0, estimatedFinishAt: null, startedFrom: null, route: null });
    }

    const latestPing = assignment.vehicleId
      ? await prisma.locationPing.findFirst({ where: { vehicleId: assignment.vehicleId }, orderBy: { recordedAt: "desc" } })
      : null;
    // Only start from the vehicle when that position is fresh and near the
    // stops: an old fix (or an emulator's default location) would send the
    // run, and its road line, off across the world.
    const nearStops = (p) => jobs.some((j) => distanceKm(p.latitude, p.longitude, j.latitude, j.longitude) <= START_MAX_KM);
    const lastPing =
      latestPing && Date.now() - new Date(latestPing.recordedAt).getTime() <= START_MAX_AGE_MS && nearStops(latestPing) ? latestPing : null;
    const start = lastPing ? { lat: lastPing.latitude, lng: lastPing.longitude } : { lat: jobs[0].latitude, lng: jobs[0].longitude };

    // Jobs already under way stay first; only the untouched ones are reordered.
    const inProgress = jobs.filter((j) => j.status !== "assigned").sort((a, b) => a.sequence - b.sequence);
    const pending = jobs.filter((j) => j.status === "assigned");
    const result = optimizeStops(pending, start, new Date());
    const ordered = [...inProgress, ...result.order];
    await prisma.$transaction(ordered.map((j, i) => prisma.job.update({ where: { id: j.id }, data: { sequence: i + 1 } })));

    const fresh = await prisma.job.findMany({
      where: { id: { in: ordered.map((j) => j.id) } },
      include: LIST_INCLUDE,
      orderBy: { sequence: "asc" },
    });

    // Draw the run along the roads, from the vehicle (when it has reported)
    // through every stop in the new order, and keep it for the dashboard
    // and the driver app.
    const stops = [...(lastPing ? [start] : []), ...ordered.map((j) => ({ lat: j.latitude, lng: j.longitude }))];
    const drawn = await drawRun(stops);
    const routeData = {
      companyId: jobs[0].companyId,
      path: drawn.path,
      jobIds: ordered.map((j) => j.id),
      startLat: lastPing ? start.lat : null,
      startLng: lastPing ? start.lng : null,
      distanceKm: drawn.distanceKm,
      durationMin: drawn.durationMin,
      source: drawn.source,
    };
    const route = await prisma.jobRoute.upsert({
      where: { driverId_scheduledDate: { driverId: assignment.driverId, scheduledDate } },
      create: { ...routeData, driverId: assignment.driverId, scheduledDate },
      update: routeData,
    });

    return res.json({
      jobs: fresh.map(present),
      // Road distance when the line follows the roads, else the estimate.
      distanceKm: Math.round((drawn.distanceKm ?? result.km) * 10) / 10,
      lateMinutes: Math.round(result.lateMinutes),
      estimatedFinishAt: result.finishAt,
      startedFrom: lastPing ? "vehicle_location" : "first_stop",
      route: toApi(route),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to optimize route" });
  }
}

// ADMIN/COMPANY_OWNER — the optimized road lines for a day (default today),
// one per driver who has one.
export async function listJobRoutes(req, res) {
  try {
    const scheduledDate = isDateKey(req.query.date) ? req.query.date : todayKey();
    const routes = await prisma.jobRoute.findMany({ where: { ...tenantScope(req), scheduledDate } });
    return res.json(routes.map(toApi));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch job routes" });
  }
}

// DRIVER — today's road line through their jobs, or null when dispatch
// hasn't optimized their run (or changed it since).
export async function getMyJobRoute(req, res) {
  try {
    const route = await prisma.jobRoute.findUnique({
      where: { driverId_scheduledDate: { driverId: req.user.id, scheduledDate: todayKey() } },
    });
    return res.json(route ? toApi(route) : null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your route" });
  }
}

// DRIVER — their open jobs (today and overdue earlier days) plus today's
// finished ones, in the order they should be done.
export async function listMyJobs(req, res) {
  try {
    const today = todayKey();
    const jobs = await prisma.job.findMany({
      where: {
        driverId: req.user.id,
        OR: [
          { status: { in: OPEN_STATUSES }, scheduledDate: { lte: today } },
          { scheduledDate: today, status: { in: ["completed", "failed"] } },
        ],
      },
      orderBy: [{ scheduledDate: "asc" }, { sequence: "asc" }, { createdAt: "asc" }],
    });
    return res.json(jobs.map(present));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your jobs" });
  }
}

// DRIVER — one of their own jobs, whatever its date or status
export async function getMyJob(req, res) {
  try {
    const job = await prisma.job.findFirst({ where: { id: req.params.id, driverId: req.user.id } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(present(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
}

// DRIVER — move a job forward: started → arrived → completed, or failed (with
// a reason) from any open state. Completing needs proof: a photo, a
// signature, or a note.
export async function updateMyJobStatus(req, res) {
  try {
    const job = await prisma.job.findFirst({ where: { id: req.params.id, driverId: req.user.id } });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const { status } = req.body;
    if (!NEXT_STATUS[job.status]?.includes(status)) {
      return res.status(400).json({ error: `A ${job.status} job can't be marked ${status}` });
    }
    const now = new Date();
    const lat = typeof req.body.latitude === "number" ? req.body.latitude : undefined;
    const lng = typeof req.body.longitude === "number" ? req.body.longitude : undefined;

    if (status === "failed") {
      const reason = String(req.body.failureReason || "").trim();
      if (!reason) return res.status(400).json({ error: "Please give a reason the job couldn't be completed" });
      const failed = await prisma.job.update({
        where: { id: job.id },
        data: { status: "failed", failureReason: reason.slice(0, 500), failedAt: now },
      });
      if (failed.vehicleId) {
        await raiseAlert({
          companyId: failed.companyId,
          vehicleId: failed.vehicleId,
          type: "job_failed",
          message: `Job "${failed.title}" at ${failed.address} couldn't be completed: ${failed.failureReason}`,
          debounceMinutes: 0,
        });
      }
      return res.json(present(failed));
    }

    const data = {};
    if (status === "completed") {
      const proof = req.body.proof || {};
      const photoUploadIds = await ownedUploadIds(proof.photoUploadIds, job.companyId);
      const [signatureUploadId] = await ownedUploadIds([proof.signatureUploadId], job.companyId);
      const notes = proof.notes ? String(proof.notes).slice(0, 1000) : null;
      if (!photoUploadIds.length && !signatureUploadId && !notes) {
        return res.status(400).json({ error: "Add a photo, a signature or a note as proof of delivery" });
      }
      data.proof = {
        photoUploadIds,
        signatureUploadId: signatureUploadId || null,
        recipientName: proof.recipientName ? String(proof.recipientName).slice(0, 200) : null,
        notes,
        scannedCode: proof.scannedCode ? String(proof.scannedCode).slice(0, 200) : null,
        latitude: lat,
        longitude: lng,
        capturedAt: now.toISOString(),
      };
      data.completedAt = now;
    }
    if (status === "started") data.startedAt = now;
    if (status === "arrived") data.arrivedAt = now;
    data.status = status;
    const updated = await prisma.job.update({ where: { id: job.id }, data });
    return res.json(present(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update job" });
  }
}

// PUBLIC — what the customer's ETA link shows. Deliberately minimal: no
// driver surname, phone or exact route history, and the live position
// only while the driver is actually on the way.
export async function getPublicTracking(req, res) {
  try {
    const job = await prisma.job.findUnique({
      where: { trackingToken: String(req.params.token) },
      include: {
        driver: { select: { fullName: true } },
        vehicle: { select: { id: true, plateNumber: true } },
        company: { select: { name: true } },
      },
    });
    if (!job) return res.status(404).json({ error: "This tracking link isn't valid" });

    let driverLocation = null;
    let etaMinutes = null;
    let distanceRemainingKm = null;
    if (["started", "arrived"].includes(job.status) && job.vehicle) {
      const ping = await prisma.locationPing.findFirst({ where: { vehicleId: job.vehicle.id }, orderBy: { recordedAt: "desc" } });
      if (ping && Date.now() - ping.recordedAt.getTime() < 30 * 60000) {
        driverLocation = { latitude: ping.latitude, longitude: ping.longitude, recordedAt: ping.recordedAt };
        distanceRemainingKm = Math.round(distanceKm(ping.latitude, ping.longitude, job.latitude, job.longitude) * 13) / 10;
        etaMinutes = job.status === "arrived" ? 0 : Math.max(1, Math.round(driveMinutes(ping.latitude, ping.longitude, job.latitude, job.longitude)));
      }
    }

    res.set("Cache-Control", "no-store");
    return res.json({
      companyName: job.company?.name ?? null,
      title: job.title,
      address: job.address,
      destination: { latitude: job.latitude, longitude: job.longitude },
      status: job.status,
      windowStart: job.windowStart,
      windowEnd: job.windowEnd,
      driverFirstName: job.driver?.fullName?.split(" ")[0] ?? null,
      plateNumber: job.vehicle?.plateNumber ?? null,
      driverLocation,
      etaMinutes,
      distanceRemainingKm,
      completedAt: job.completedAt,
      failureReason: job.status === "failed" ? job.failureReason : null,
      updatedAt: job.updatedAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load tracking" });
  }
}
