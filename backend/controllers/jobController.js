import crypto from "crypto";
import Job from "../models/Job.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import LocationPing from "../models/LocationPing.js";
import { tenantScope } from "../middleware/auth.js";
import { raiseAlert } from "../lib/alerts.js";
import { getPlaceLocation } from "../services/googleMapsService.js";
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

export function isLate(job) {
  return !!(job.windowEnd && job.completedAt && new Date(job.completedAt) > new Date(job.windowEnd));
}

function present(job) {
  const o = job.toObject ? job.toObject() : job;
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

async function resolveDriverAndVehicle(req, driverId) {
  if (!driverId) return { driverId: null, vehicleId: null };
  const driver = await User.findOne({ _id: driverId, role: "DRIVER", ...tenantScope(req) }).select("_id companyId");
  if (!driver) return { error: "Driver not found" };
  const vehicle = await Vehicle.findOne({ driverId: driver._id }).select("_id");
  return { driverId: driver._id, vehicleId: vehicle?._id ?? null, companyId: driver.companyId };
}

// ADMIN/COMPANY_OWNER — jobs for a day (default today), optionally one driver/status
export async function listJobs(req, res) {
  try {
    const filter = { ...tenantScope(req) };
    if (isDateKey(req.query.date)) filter.scheduledDate = req.query.date;
    else if (!req.query.from) filter.scheduledDate = todayKey();
    if (isDateKey(req.query.from) && isDateKey(req.query.to)) filter.scheduledDate = { $gte: req.query.from, $lte: req.query.to };
    if (req.query.driverId) filter.driverId = req.query.driverId;
    if (req.query.status) filter.status = req.query.status;
    const jobs = await Job.find(filter)
      .populate("driverId", "fullName")
      .populate("vehicleId", "plateNumber")
      .sort({ driverId: 1, sequence: 1, createdAt: 1 })
      .limit(1000);
    return res.json(jobs.map(present));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
}

export async function getJob(req, res) {
  try {
    const job = await Job.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate("driverId", "fullName phone")
      .populate("vehicleId", "plateNumber");
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
    const lastSequence = assignment.driverId
      ? await Job.findOne({ driverId: assignment.driverId, scheduledDate }).sort({ sequence: -1 }).select("sequence")
      : null;

    const job = await Job.create({
      companyId,
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
      sequence: (lastSequence?.sequence ?? 0) + 1,
      trackingToken: crypto.randomBytes(18).toString("hex"),
      createdBy: req.user.id,
    });
    return res.status(201).json(present(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create job" });
  }
}

export async function updateJob(req, res) {
  try {
    const job = await Job.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!job) return res.status(404).json({ error: "Job not found" });

    for (const field of EDITABLE_FIELDS) {
      if (!(field in req.body)) continue;
      if (field === "windowStart" || field === "windowEnd") job[field] = req.body[field] ? new Date(req.body[field]) : null;
      else if (field === "scheduledDate") {
        if (isDateKey(req.body.scheduledDate)) job.scheduledDate = req.body.scheduledDate;
      } else job[field] = req.body[field];
    }
    if ("latitude" in req.body && "longitude" in req.body) {
      job.latitude = Number(req.body.latitude);
      job.longitude = Number(req.body.longitude);
    } else if ("address" in req.body) {
      const place = await getPlaceLocation(job.address);
      if (place.error) return res.status(400).json({ error: `Couldn't find that address: ${place.error}` });
      job.latitude = place.lat;
      job.longitude = place.lng;
    }
    if ("driverId" in req.body) {
      const assignment = await resolveDriverAndVehicle(req, req.body.driverId);
      if (assignment.error) return res.status(404).json({ error: assignment.error });
      job.driverId = assignment.driverId;
      job.vehicleId = assignment.vehicleId;
    }
    if (req.body.status === "cancelled" && OPEN_STATUSES.includes(job.status)) job.status = "cancelled";
    // Moved to another driver or day without an explicit position: put it
    // at the end of that list rather than colliding with an existing stop.
    if ((job.isModified("driverId") || job.isModified("scheduledDate")) && !("sequence" in req.body) && job.driverId) {
      const last = await Job.findOne({ _id: { $ne: job._id }, driverId: job.driverId, scheduledDate: job.scheduledDate })
        .sort({ sequence: -1 })
        .select("sequence");
      job.sequence = (last?.sequence ?? 0) + 1;
    }
    await job.save();
    return res.json(present(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update job" });
  }
}

export async function deleteJob(req, res) {
  try {
    const job = await Job.findOneAndDelete({ _id: req.params.id, ...tenantScope(req) });
    if (!job) return res.status(404).json({ error: "Job not found" });
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

    const jobs = await Job.find({ driverId: assignment.driverId, scheduledDate, status: { $in: OPEN_STATUSES } });
    if (jobs.length === 0) return res.json({ jobs: [], distanceKm: 0, lateMinutes: 0, estimatedFinishAt: null, startedFrom: null });

    const lastPing = assignment.vehicleId
      ? await LocationPing.findOne({ vehicleId: assignment.vehicleId }).sort({ recordedAt: -1 })
      : null;
    const start = lastPing ? { lat: lastPing.latitude, lng: lastPing.longitude } : { lat: jobs[0].latitude, lng: jobs[0].longitude };

    // Jobs already under way stay first; only the untouched ones are reordered.
    const inProgress = jobs.filter((j) => j.status !== "assigned").sort((a, b) => a.sequence - b.sequence);
    const pending = jobs.filter((j) => j.status === "assigned");
    const result = optimizeStops(pending, start, new Date());
    const ordered = [...inProgress, ...result.order];
    await Promise.all(ordered.map((j, i) => Job.updateOne({ _id: j._id }, { $set: { sequence: i + 1 } })));

    const fresh = await Job.find({ _id: { $in: ordered.map((j) => j._id) } })
      .populate("driverId", "fullName")
      .populate("vehicleId", "plateNumber")
      .sort({ sequence: 1 });
    return res.json({
      jobs: fresh.map(present),
      distanceKm: Math.round(result.km * 10) / 10,
      lateMinutes: Math.round(result.lateMinutes),
      estimatedFinishAt: result.finishAt,
      startedFrom: lastPing ? "vehicle_location" : "first_stop",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to optimize route" });
  }
}

// DRIVER — their open jobs (today and overdue earlier days) plus today's
// finished ones, in the order they should be done.
export async function listMyJobs(req, res) {
  try {
    const today = todayKey();
    const jobs = await Job.find({
      driverId: req.user.id,
      $or: [
        { status: { $in: OPEN_STATUSES }, scheduledDate: { $lte: today } },
        { scheduledDate: today, status: { $in: ["completed", "failed"] } },
      ],
    }).sort({ scheduledDate: 1, sequence: 1 });
    return res.json(jobs.map(present));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your jobs" });
  }
}

// DRIVER — one of their own jobs, whatever its date or status
export async function getMyJob(req, res) {
  try {
    const job = await Job.findOne({ _id: req.params.id, driverId: req.user.id });
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
    const job = await Job.findOne({ _id: req.params.id, driverId: req.user.id });
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
      job.status = "failed";
      job.failureReason = reason.slice(0, 500);
      job.failedAt = now;
      await job.save();
      if (job.vehicleId) {
        await raiseAlert({
          companyId: job.companyId,
          vehicleId: job.vehicleId,
          type: "job_failed",
          message: `Job "${job.title}" at ${job.address} couldn't be completed: ${job.failureReason}`,
          debounceMinutes: 0,
        });
      }
      return res.json(present(job));
    }

    if (status === "completed") {
      const proof = req.body.proof || {};
      const photoUploadIds = await ownedUploadIds(proof.photoUploadIds, job.companyId);
      const [signatureUploadId] = await ownedUploadIds([proof.signatureUploadId], job.companyId);
      const notes = proof.notes ? String(proof.notes).slice(0, 1000) : null;
      if (!photoUploadIds.length && !signatureUploadId && !notes) {
        return res.status(400).json({ error: "Add a photo, a signature or a note as proof of delivery" });
      }
      job.proof = {
        photoUploadIds,
        signatureUploadId: signatureUploadId || null,
        recipientName: proof.recipientName ? String(proof.recipientName).slice(0, 200) : null,
        notes,
        scannedCode: proof.scannedCode ? String(proof.scannedCode).slice(0, 200) : null,
        latitude: lat,
        longitude: lng,
        capturedAt: now,
      };
      job.completedAt = now;
    }
    if (status === "started") job.startedAt = now;
    if (status === "arrived") job.arrivedAt = now;
    job.status = status;
    await job.save();
    return res.json(present(job));
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
    const job = await Job.findOne({ trackingToken: req.params.token })
      .populate("driverId", "fullName")
      .populate("vehicleId", "plateNumber")
      .populate("companyId", "name");
    if (!job) return res.status(404).json({ error: "This tracking link isn't valid" });

    let driverLocation = null;
    let etaMinutes = null;
    let distanceRemainingKm = null;
    if (["started", "arrived"].includes(job.status) && job.vehicleId) {
      const ping = await LocationPing.findOne({ vehicleId: job.vehicleId._id }).sort({ recordedAt: -1 });
      if (ping && Date.now() - ping.recordedAt.getTime() < 30 * 60000) {
        driverLocation = { latitude: ping.latitude, longitude: ping.longitude, recordedAt: ping.recordedAt };
        distanceRemainingKm = Math.round(distanceKm(ping.latitude, ping.longitude, job.latitude, job.longitude) * 13) / 10;
        etaMinutes = job.status === "arrived" ? 0 : Math.max(1, Math.round(driveMinutes(ping.latitude, ping.longitude, job.latitude, job.longitude)));
      }
    }

    res.set("Cache-Control", "no-store");
    return res.json({
      companyName: job.companyId?.name ?? null,
      title: job.title,
      address: job.address,
      destination: { latitude: job.latitude, longitude: job.longitude },
      status: job.status,
      windowStart: job.windowStart,
      windowEnd: job.windowEnd,
      driverFirstName: job.driverId?.fullName?.split(" ")[0] ?? null,
      plateNumber: job.vehicleId?.plateNumber ?? null,
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
