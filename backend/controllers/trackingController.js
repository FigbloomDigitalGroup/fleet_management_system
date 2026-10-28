import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { distanceKm, isInsideGeofence, sumTripDistanceKm, MAX_PLAUSIBLE_SPEED_KPH } from "../lib/geo.js";
import { raiseAlert } from "../lib/alerts.js";
import { getCompanySettings, isWithinTrackingHours } from "../lib/companySettings.js";
import { analyzePings } from "../lib/stops.js";
import { filterTrack, cleanTrack } from "../lib/gpsFilter.js";
import { queueRoadPath } from "../lib/tripRoad.js";
import { reverseGeocode } from "../services/geocodeService.js";

// Bump when the consent wording in the mobile app changes, so drivers are
// asked to accept again.
export const TRACKING_CONSENT_VERSION = "2026-10";

// A trip ends once the vehicle has stood still this long. Silence is not
// the same as stopping — the driver app reports every minute even when
// parked, so a quiet phone has usually just lost signal and will upload its
// buffered points later. Those points continue the same trip: a vehicle
// that moves again within this window of its last trip ending resumes that
// trip instead of starting a new one.
const TRIP_IDLE_TIMEOUT_MINUTES = 120;
const TRIP_IDLE_TIMEOUT_MS = TRIP_IDLE_TIMEOUT_MINUTES * 60 * 1000;
// Speeding / harsh-driving noise filters (see processPing).
const MAX_EVENT_ACCURACY_M = 25; // fixes less accurate than this are ignored for events
const SPEEDING_CONFIRM_SECONDS = 60; // two over-limit fixes within this window
const HARSH_MAX_GAP_SECONDS = 10; // a rate over a longer gap is an average, not an event
const HARSH_MIN_SPEED_KPH = 25; // the faster side of the change must be real driving speed
const HARSH_MIN_CHANGE_KPH = 12; // and the speed must actually change this much
const FUEL_ANOMALY_THRESHOLD_PCT = 50;
const MOCK_LOCATION_ALERT_DEBOUNCE_MINUTES = 30;
const DRIVING_EVENT_DEBOUNCE_SECONDS = 60; // one incident per type per minute
// Buffered points older than this are dropped rather than fully processed —
// a multi-day-old backlog from an extended outage would otherwise get
// replayed point-by-point through the full trip/alert pipeline, taking
// far longer than the outage itself to catch up to "now".
const MAX_PING_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000; // tolerate phones up to 2 min fast
const MAX_BATCH_SIZE = 500;

// Distance in km from a point to the nearest segment of a route's waypoints
function distanceToRouteKm(lat, lng, waypoints) {
  if (!waypoints || waypoints.length === 0) return null;
  if (waypoints.length === 1) return distanceKm(lat, lng, waypoints[0].lat, waypoints[0].lng);

  let minDist = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dA = distanceKm(lat, lng, waypoints[i].lat, waypoints[i].lng);
    const dB = distanceKm(lat, lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
    minDist = Math.min(minDist, dA, dB);
  }
  return minDist;
}

// Records one unsafe-driving incident for driver scoring, collapsing repeats
// of the same type within a minute into a single incident (a vehicle held
// over the limit pings every few seconds).
export async function recordDrivingEvent({ vehicle, type, source, value, speedKph, latitude, longitude, at }) {
  const since = new Date(at.getTime() - DRIVING_EVENT_DEBOUNCE_SECONDS * 1000);
  const recent = await prisma.drivingEvent.findFirst({
    where: { vehicleId: vehicle.id, type, recordedAt: { gte: since, lte: at } },
    select: { id: true },
  });
  if (recent) return null;
  return prisma.drivingEvent.create({
    data: {
      companyId: vehicle.companyId,
      vehicleId: vehicle.id,
      driverId: vehicle.driverId || null,
      type,
      source,
      value: value ?? null,
      speedKph: speedKph ?? null,
      latitude,
      longitude,
      recordedAt: at,
    },
  });
}

// Validates the phone-supplied timestamp: offline-buffered points keep their
// real capture time, but nothing from the future (bad phone clock) or so old
// it's useless. Returns null for a point that should be dropped.
function resolveRecordedAt(raw) {
  const now = Date.now();
  if (raw === undefined || raw === null) return new Date(now);
  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) return new Date(now);
  if (t.getTime() > now + MAX_CLOCK_SKEW_MS) return new Date(now);
  if (t.getTime() < now - MAX_PING_AGE_MS) return null;
  return t;
}

// Resolves which vehicle a ping is for and checks the caller may report for
// it. A hardware tracker's token already identifies exactly one vehicle —
// trust that over anything in the body. Otherwise only the driver assigned
// to the vehicle may report for it: admins can't, so nobody can put a
// vehicle somewhere it isn't (it would create trips and alerts, and count
// against the driver's safety score).
async function resolveTrackingVehicle(req) {
  if (req.trackingVehicle) return { vehicle: req.trackingVehicle };
  if (req.user.role !== "DRIVER") {
    return { status: 403, error: "Only the assigned driver's app or a GPS tracker can report a vehicle's location" };
  }
  const { vehicleId } = req.body;
  if (!vehicleId) return { status: 400, error: "vehicleId is required" };

  const vehicle = await prisma.vehicle.findUnique({ where: { id: String(vehicleId) } });
  if (!vehicle) return { status: 404, error: "Vehicle not found" };
  if (req.user.role === "DRIVER" && String(vehicle.driverId) !== String(req.user.id)) {
    return { status: 403, error: "This vehicle isn't assigned to you" };
  }
  if (req.user.role !== "PLATFORM_ADMIN" && String(vehicle.companyId) !== String(req.user.companyId)) {
    return { status: 403, error: "You do not have permission to report location for this vehicle" };
  }
  return { vehicle };
}

// Runs every per-ping rule (status, trips, idling, speeding, harsh driving,
// route deviation/completion, fuel, geofences) for one point, evaluated at
// the point's own time `t` rather than "now" so a backlog uploaded after a
// dead zone is judged exactly as if it had arrived live.
async function processPing(vehicle, data, source) {
  const { latitude, longitude, speedKph, heading, fuelLevelLiters, accuracyM, isMocked } = data;
  const t = data.recordedAt;
  const vehicleId = vehicle.id;
  const { alertSettings } = await getCompanySettings(vehicle.companyId);
  const isMoving = speedKph && speedKph > 2;

  // A retried upload resends points the server already has.
  const duplicate = await prisma.locationPing.findFirst({
    where: { vehicleId, recordedAt: t, latitude, longitude },
    select: { id: true },
  });
  if (duplicate) return { skipped: true };

  // Neighbours in time, not just the latest row — buffered points can arrive
  // after newer live ones.
  const previousPing = await prisma.locationPing.findFirst({
    where: { vehicleId, recordedAt: { lt: t } },
    orderBy: { recordedAt: "desc" },
  });
  const newerPingExists = await prisma.locationPing.findFirst({
    where: { vehicleId, recordedAt: { gt: t } },
    select: { id: true },
  });

  // 1. Save the raw ping
  const ping = await prisma.locationPing.create({
    data: {
      vehicleId,
      latitude,
      longitude,
      speedKph: speedKph ?? null,
      heading: heading ?? null,
      fuelLevelLiters: fuelLevelLiters ?? null,
      accuracyM: accuracyM ?? null,
      isMocked: !!isMocked,
      source,
      recordedAt: t,
    },
  });

  // 1b. Fake GPS — the phone flagged this fix as coming from a mock provider.
  if (isMocked) {
    await raiseAlert({
      companyId: vehicle.companyId,
      vehicleId,
      type: "mock_location",
      message: "This phone is reporting a fake (mock) GPS location — the vehicle's real position can't be trusted.",
      debounceMinutes: MOCK_LOCATION_ALERT_DEBOUNCE_MINUTES,
      at: t,
    });
  }

  // 2. Vehicle status reflects only the newest known point — an old buffered
  // one must not flip a vehicle that's moving right now back to "idle".
  if (!newerPingExists) {
    if (!vehicle.driverId) {
      vehicle.status = "offline";
      vehicle.statusManuallySet = false;

      // Flag it if the vehicle is actually moving with nobody assigned to it
      if (isMoving) {
        await raiseAlert({
          companyId: vehicle.companyId,
          vehicleId,
          type: "unauthorized_movement",
          message: `Vehicle is moving at ${speedKph} km/h with no driver assigned.`,
          at: t,
        });
      }
    } else if (isMoving) {
      // Movement always wins — resumes automatic status tracking even if an
      // admin had manually pinned a status (e.g. "maintenance") earlier.
      vehicle.status = "active";
      vehicle.statusManuallySet = false;
    } else if (!vehicle.statusManuallySet) {
      // Only auto-set to idle when nobody has manually overridden the status —
      // otherwise an admin's manual pick (e.g. "idle"/"maintenance") sticks until
      // the vehicle is next seen moving.
      vehicle.status = "idle";
    }
    // a fresh offline streak may alert again
    vehicle.device = { ...(vehicle.device || {}), lastSeenAt: t.toISOString(), offlineAlertedAt: null };
    // `vehicle` is reused for the rest of a batch, so it's updated in place too.
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: vehicle.status, statusManuallySet: vehicle.statusManuallySet, device: vehicle.device },
    });
  }

  // 2b. Excessive idling — only meaningful with a driver assigned (unassigned
  // + moving is already handled above as unauthorized_movement). De-duplicated
  // per idle streak by passing the streak start as `since`.
  if (vehicle.driverId && !isMoving) {
    const lastMovingPing = await prisma.locationPing.findFirst({
      where: { vehicleId, speedKph: { gt: 2 }, recordedAt: { lte: t } },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true },
    });
    const idleStartedAt = lastMovingPing ? new Date(lastMovingPing.recordedAt) : vehicle.createdAt;
    const idleMinutes = (t.getTime() - idleStartedAt.getTime()) / 60000;

    if (idleMinutes >= alertSettings.idleMinutes) {
      await raiseAlert({
        companyId: vehicle.companyId,
        vehicleId,
        type: "excessive_idling",
        message: `Vehicle has been idling for over ${alertSettings.idleMinutes} minutes.`,
        since: idleStartedAt,
        at: t,
      });
    }
  }

  // 3. Trip start/end logic. A point that falls inside an already-finished
  // trip (a buffered point uploaded after the trip ended) only refreshes
  // that trip's distance — it must not start or end anything.
  const openTrip = await prisma.trip.findFirst({ where: { vehicleId, endTime: null }, orderBy: { startTime: "desc" } });
  const coveringTrip = await prisma.trip.findFirst({ where: { vehicleId, startTime: { lte: t }, endTime: { gte: t } } });

  if (coveringTrip) {
    const tripPings = await pingsBetween(vehicleId, coveringTrip.startTime, coveringTrip.endTime);
    await prisma.trip.update({
      where: { id: coveringTrip.id },
      data: { distanceKm: tripDistanceKm(tripPings), roadPath: null },
    });
  } else if (isMoving && !openTrip) {
    // Moving again soon after the last trip ended (e.g. buffered points from
    // a dead zone arriving after the trip was closed) — carry on with it,
    // unless the driver ended it themselves.
    const lastTrip = await prisma.trip.findFirst({ where: { vehicleId, endTime: { lte: t } }, orderBy: { endTime: "desc" } });
    if (lastTrip && lastTrip.endedBy !== "driver" && t.getTime() - lastTrip.endTime.getTime() < TRIP_IDLE_TIMEOUT_MS) {
      await prisma.trip.update({
        where: { id: lastTrip.id },
        data: { endTime: null, endLat: null, endLng: null, distanceKm: null, endedBy: null, roadPath: null },
      });
    } else {
      await prisma.trip.create({
        data: {
          vehicleId,
          driverId: vehicle.driverId || null,
          startTime: t,
          startLat: latitude,
          startLng: longitude,
        },
      });
    }
  } else if (!isMoving && openTrip && t > openTrip.startTime) {
    const stoppedPing = await findTripStopPing(openTrip, t);
    if (stoppedPing && t.getTime() - stoppedPing.recordedAt.getTime() >= TRIP_IDLE_TIMEOUT_MS) {
      await closeTrip(openTrip, stoppedPing);
    }
  }

  // GPS speed jitters, and a single bad fix can read as a burst of speed.
  // Speeding and harsh driving only count from fixes that are trustworthy
  // (not fake GPS, reasonably accurate, physically plausible).
  const trustworthy = (p) =>
    p &&
    !p.isMocked &&
    (p.accuracyM == null || p.accuracyM <= MAX_EVENT_ACCURACY_M) &&
    p.speedKph != null &&
    p.speedKph <= MAX_PLAUSIBLE_SPEED_KPH;
  const thisFix = { isMocked, accuracyM, speedKph };
  const prevGapSeconds = previousPing ? (t.getTime() - new Date(previousPing.recordedAt).getTime()) / 1000 : Infinity;

  // 4. Speeding (route-specific limit overrides the company's limit, if a route is assigned).
  // Must hold across two consecutive good fixes, so one spike isn't speeding.
  const activeRoute = await prisma.route.findFirst({ where: { vehicleId, active: true }, orderBy: { createdAt: "asc" } });
  const speedLimit = activeRoute?.speedLimitKph || alertSettings.speedLimitKph;

  if (
    trustworthy(thisFix) &&
    speedKph > speedLimit &&
    trustworthy(previousPing) &&
    previousPing.speedKph > speedLimit &&
    prevGapSeconds <= SPEEDING_CONFIRM_SECONDS
  ) {
    await recordDrivingEvent({ vehicle, type: "speeding", source: "gps", value: speedKph, speedKph, latitude, longitude, at: t });
    await raiseAlert({
      companyId: vehicle.companyId,
      vehicleId,
      type: "speeding",
      message: `Vehicle recorded at ${speedKph} km/h, exceeding the ${speedLimit} km/h limit.`,
      at: t,
    });
  }

  // 4b. Harsh braking / harsh acceleration from the GPS speed delta between
  // this point and the previous one. Works for hardware trackers too; the
  // phone app additionally reports sensor-based events (POST /events).
  // Only between two good fixes a few seconds apart, and only at real
  // driving speeds with a real change — creeping or GPS jitter in traffic
  // used to read as "harsh acceleration".
  if (trustworthy(thisFix) && trustworthy(previousPing)) {
    const deltaSeconds = prevGapSeconds;

    if (deltaSeconds >= 1 && deltaSeconds <= HARSH_MAX_GAP_SECONDS) {
      const change = speedKph - previousPing.speedKph;
      const ratePerSec = change / deltaSeconds;
      let harshType = null;
      let message = null;

      if (
        ratePerSec <= -alertSettings.harshBrakingKphPerSec &&
        previousPing.speedKph >= HARSH_MIN_SPEED_KPH &&
        -change >= HARSH_MIN_CHANGE_KPH
      ) {
        harshType = "harsh_braking";
        message = `Harsh braking detected: dropped from ${previousPing.speedKph} km/h to ${speedKph} km/h in ${deltaSeconds.toFixed(0)}s.`;
      } else if (
        ratePerSec >= alertSettings.harshAccelerationKphPerSec &&
        speedKph >= HARSH_MIN_SPEED_KPH &&
        change >= HARSH_MIN_CHANGE_KPH
      ) {
        harshType = "harsh_acceleration";
        message = `Harsh acceleration detected: rose from ${previousPing.speedKph} km/h to ${speedKph} km/h in ${deltaSeconds.toFixed(0)}s.`;
      }

      if (harshType) {
        await recordDrivingEvent({
          vehicle,
          type: harshType,
          source: "gps",
          value: Math.abs(Math.round(ratePerSec * 10) / 10),
          speedKph,
          latitude,
          longitude,
          at: t,
        });
        await raiseAlert({ companyId: vehicle.companyId, vehicleId, type: harshType, message, at: t });
      }
    }
  }

  // 5. Route deviation detection — only runs if this vehicle has an assigned route
  if (activeRoute && activeRoute.waypoints.length > 0) {
    const deviationKm = distanceToRouteKm(latitude, longitude, activeRoute.waypoints);
    const toleranceKm = activeRoute.toleranceMeters / 1000;

    if (deviationKm !== null && deviationKm > toleranceKm) {
      await raiseAlert({
        companyId: vehicle.companyId,
        vehicleId,
        type: "route_deviation",
        message: `Vehicle is ${(deviationKm * 1000).toFixed(0)}m off its assigned route "${activeRoute.name}" (allowed: ${activeRoute.toleranceMeters}m).`,
        at: t,
      });
    }
  }

  // 5b. Route completion — has the vehicle reached the destination (the
  // route's final waypoint) on this point's calendar day? Logged once per
  // day since a route recurs daily/weekly rather than being a one-off.
  if (activeRoute && activeRoute.waypoints.length > 0) {
    const destination = activeRoute.waypoints[activeRoute.waypoints.length - 1];
    const distanceToDestKm = distanceKm(latitude, longitude, destination.lat, destination.lng);
    const toleranceKm = activeRoute.toleranceMeters / 1000;

    if (distanceToDestKm <= toleranceKm) {
      const dateKey = t.toISOString().slice(0, 10);
      const alreadyCompleted = await prisma.routeCompletion.findFirst({
        where: { routeId: activeRoute.id, dateKey },
        select: { id: true },
      });

      if (!alreadyCompleted) {
        await prisma.routeCompletion.create({
          data: {
            companyId: vehicle.companyId,
            routeId: activeRoute.id,
            vehicleId,
            driverId: vehicle.driverId || null,
            dateKey,
            completedAt: t,
          },
        });
      }
    }
  }

  // 6. Fuel anomaly detection — only runs if we have fuel data on both this ping and the previous one
  if (
    fuelLevelLiters !== undefined &&
    fuelLevelLiters !== null &&
    previousPing &&
    previousPing.fuelLevelLiters !== null &&
    previousPing.fuelLevelLiters !== undefined &&
    !previousPing.isMocked &&
    !isMocked
  ) {
    const distanceSinceLastPingKm = distanceKm(previousPing.latitude, previousPing.longitude, latitude, longitude);
    const hoursSinceLastPing = (t.getTime() - new Date(previousPing.recordedAt).getTime()) / 3600000;
    // A GPS glitch between these two points would inflate the distance (and
    // so the expected-fuel-use figure it's compared against) — skip rather
    // than judge consumption against a jump that didn't really happen.
    const isGlitch = hoursSinceLastPing > 0 && distanceSinceLastPingKm / hoursSinceLastPing > MAX_PLAUSIBLE_SPEED_KPH;
    const fuelDropLiters = previousPing.fuelLevelLiters - fuelLevelLiters;

    if (!isGlitch && distanceSinceLastPingKm > 0.5 && fuelDropLiters > 0) {
      const expectedDropLiters = (vehicle.avgConsumptionLPer100Km / 100) * distanceSinceLastPingKm;
      const percentOverExpected =
        expectedDropLiters > 0 ? ((fuelDropLiters - expectedDropLiters) / expectedDropLiters) * 100 : 0;

      if (percentOverExpected > FUEL_ANOMALY_THRESHOLD_PCT) {
        await raiseAlert({
          companyId: vehicle.companyId,
          vehicleId,
          type: "fuel_anomaly",
          message: `Unusual fuel consumption: used ${fuelDropLiters.toFixed(1)}L over ${distanceSinceLastPingKm.toFixed(1)}km, ${percentOverExpected.toFixed(0)}% more than expected for this vehicle.`,
          at: t,
        });
      }
    }
  }

  // 7. Geofence entry/exit detection
  const geofences = await prisma.geofence.findMany({ where: { companyId: vehicle.companyId } });

  for (const geofence of geofences) {
    const isInsideNow = isInsideGeofence(latitude, longitude, geofence);
    const wasInsideBefore = previousPing
      ? isInsideGeofence(previousPing.latitude, previousPing.longitude, geofence)
      : false;

    if (isInsideNow !== wasInsideBefore) {
      await raiseAlert({
        companyId: vehicle.companyId,
        vehicleId,
        type: isInsideNow ? "geofence_entry" : "geofence_exit",
        message: `Vehicle ${isInsideNow ? "entered" : "exited"} geofence "${geofence.name}".`,
        debounceMinutes: 0,
        at: t,
      });
    }
  }

  return { ping };
}

// Numbers may arrive as strings (Mongoose used to cast them); anything that
// isn't a number becomes "not reported".
const optionalNumber = (v) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

function normalizePoint(p) {
  return {
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    speedKph: optionalNumber(p.speedKph),
    heading: optionalNumber(p.heading),
    fuelLevelLiters: optionalNumber(p.fuelLevelLiters) ?? (p.fuelLevelLiters === null ? null : undefined),
    accuracyM: optionalNumber(p.accuracyM ?? p.accuracy) ?? null,
    isMocked: !!p.isMocked,
    recordedAt: resolveRecordedAt(p.recordedAt),
  };
}

const isValidPoint = (p) =>
  Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

// POST /api/tracking/ping — one point ({ latitude, longitude, ... }) or a
// batch ({ vehicleId, pings: [...] }) for points the phone buffered while
// offline. Each point may carry its own recordedAt (ISO time of the fix).
export async function ingestLocation(req, res) {
  try {
    const isBatch = Array.isArray(req.body.pings);
    if (!isBatch && (req.body.latitude === undefined || req.body.longitude === undefined)) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }
    if (isBatch && req.body.pings.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ error: `At most ${MAX_BATCH_SIZE} points per batch` });
    }

    const resolved = await resolveTrackingVehicle(req);
    if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });
    const { vehicle } = resolved;
    const source = req.trackingSource || "manual";

    const points = (isBatch ? req.body.pings : [req.body])
      .map(normalizePoint)
      .filter((p) => p.recordedAt && isValidPoint(p))
      .sort((a, b) => a.recordedAt - b.recordedAt);

    let accepted = 0;
    let skipped = (isBatch ? req.body.pings.length : 1) - points.length;
    let lastPing = null;
    for (const point of points) {
      const result = await processPing(vehicle, point, source);
      if (result.skipped) skipped += 1;
      else {
        accepted += 1;
        lastPing = result.ping;
      }
    }

    if (isBatch) return res.status(201).json({ accepted, skipped });
    if (!lastPing) return res.status(200).json({ accepted, skipped });
    return res.status(201).json(toApi(lastPing));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to record location ping" });
  }
}

// The point where the vehicle came to rest on this trip, as of time `upTo`:
// the first ping after its last moving one. If it was still moving at its
// latest ping (e.g. the phone lost signal mid-drive), that ping is the best
// guess. Null if the trip has no pings at all.
async function findTripStopPing(trip, upTo) {
  const range = { gte: trip.startTime, lte: upTo };
  const lastMoving = await prisma.locationPing.findFirst({
    where: { vehicleId: trip.vehicleId, recordedAt: range, speedKph: { gt: 2 } },
    orderBy: { recordedAt: "desc" },
  });
  if (lastMoving) {
    const firstStopped = await prisma.locationPing.findFirst({
      where: { vehicleId: trip.vehicleId, recordedAt: { gt: lastMoving.recordedAt, lte: upTo } },
      orderBy: { recordedAt: "asc" },
    });
    return firstStopped || lastMoving;
  }
  return prisma.locationPing.findFirst({ where: { vehicleId: trip.vehicleId, recordedAt: range }, orderBy: { recordedAt: "asc" } });
}

// Trip distance in km (one decimal) over the cleaned track — inaccurate
// fixes, jumps and parked GPS wobble don't add kilometres (lib/gpsFilter.js).
export function tripDistanceKm(pings) {
  return Math.round(sumTripDistanceKm(filterTrack(pings)) * 10) / 10;
}

// A vehicle's pings in [from, to], oldest first — what tripDistanceKm needs.
function pingsBetween(vehicleId, from, to) {
  return prisma.locationPing.findMany({
    where: { vehicleId, recordedAt: { gte: from, lte: to } },
    orderBy: { recordedAt: "asc" },
    select: { latitude: true, longitude: true, recordedAt: true, isMocked: true, accuracyM: true, speedKph: true },
  });
}

// Ends the trip where the vehicle stopped, not where it was last seen idling.
async function closeTrip(trip, stopPing) {
  const tripPings = await pingsBetween(trip.vehicleId, trip.startTime, stopPing.recordedAt);
  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      endTime: stopPing.recordedAt,
      endLat: stopPing.latitude,
      endLng: stopPing.longitude,
      distanceKm: tripDistanceKm(tripPings),
      endedBy: "auto",
      roadPath: null,
    },
  });
  queueRoadPath(trip.id);
}

// Closes out trips whose vehicle has gone quiet for the whole idle timeout
// (phone off, app stopped, tracking window closed) — the reactive close in
// processPing needs a new ping to run, so without this sweep those trips
// would stay open forever and never show up anywhere that only lists
// completed trips (e.g. VehicleTripsMap). If the phone was only out of
// signal, its buffered points reopen the trip when they arrive (see
// processPing). Runs on a schedule from Index.js.
export async function closeStaleTrips() {
  const openTrips = await prisma.trip.findMany({ where: { endTime: null } });
  let closedCount = 0;

  for (const trip of openTrips) {
    const lastPing = await prisma.locationPing.findFirst({
      where: { vehicleId: trip.vehicleId },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true },
    });
    if (!lastPing) continue;
    if (Date.now() - lastPing.recordedAt.getTime() < TRIP_IDLE_TIMEOUT_MS) continue;

    const stopPing = await findTripStopPing(trip, lastPing.recordedAt);
    if (!stopPing) continue;
    await closeTrip(trip, stopPing);
    closedCount += 1;
  }

  return closedCount;
}

export async function getLiveLocations(req, res) {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: tenantScope(req),
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        plateNumber: true,
        status: true,
        vehicleType: true,
        device: true,
        driver: { select: { id: true, fullName: true, phone: true, avatarUploadId: true } },
      },
    });
    const results = await Promise.all(
      vehicles.map(async (v) => {
        const lastPing = await prisma.locationPing.findFirst({ where: { vehicleId: v.id }, orderBy: { recordedAt: "desc" } });

        return {
          vehicleId: v.id,
          plateNumber: v.plateNumber,
          status: v.status,
          vehicleType: v.vehicleType,
          driverId: v.driver ? toApi(v.driver) : null,
          device: v.device || null,
          lastLocation: lastPing ? toApi(lastPing) : null,
        };
      })
    );
    return res.json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch live locations" });
  }
}







// ---------------------------------------------------------------------------
// Phone-side reliability: device status, sensor events, offline sweep
// ---------------------------------------------------------------------------

const DEVICE_STATUS_EVENTS = ["heartbeat", "tracking_started", "tracking_stopped", "logout", "location_disabled"];

// DRIVER — the phone reports its own state: battery, whether location
// services/permission are on, foreground vs background, and lifecycle
// events (sharing turned off, logged out). Raises the tamper alerts the
// dashboard needs to tell "vehicle parked" apart from "driver switched it off".
export async function reportDeviceStatus(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id } });
    if (!vehicle) return res.status(400).json({ error: "No vehicle is assigned to you yet" });

    const { batteryLevel, isCharging, locationEnabled, permission, appState, isSharing, platform, appVersion } = req.body;
    const event = DEVICE_STATUS_EVENTS.includes(req.body.event) ? req.body.event : "heartbeat";
    const previous = vehicle.device ?? {};
    const { alertSettings } = await getCompanySettings(vehicle.companyId);

    const device = {
      ...previous,
      lastSeenAt: new Date().toISOString(),
      ...(typeof batteryLevel === "number" ? { batteryLevel: Math.max(0, Math.min(1, batteryLevel)) } : {}),
      ...(typeof isCharging === "boolean" ? { isCharging } : {}),
      ...(typeof locationEnabled === "boolean" ? { locationEnabled } : {}),
      ...(typeof permission === "string" ? { permission } : {}),
      ...(typeof appState === "string" ? { appState } : {}),
      ...(typeof isSharing === "boolean" ? { isSharing } : {}),
      ...(typeof platform === "string" ? { platform } : {}),
      ...(typeof appVersion === "string" ? { appVersion } : {}),
      offlineAlertedAt: null,
    };
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { device } });

    const base = { companyId: vehicle.companyId, vehicleId: vehicle.id };
    // Only worth an alert if the phone was actually tracking when they left.
    if (event === "logout" && previous.isSharing) {
      await raiseAlert({ ...base, type: "app_logout", message: "The driver logged out of the app — location tracking has stopped." });
    }
    if (event === "tracking_stopped") {
      await raiseAlert({ ...base, type: "tracking_stopped", message: "The driver turned off location sharing in the app." });
    }
    if (event === "location_disabled" || (locationEnabled === false && previous.locationEnabled !== false)) {
      await raiseAlert({
        ...base,
        type: "location_disabled",
        message: "Location services were turned off on the driver's phone.",
        debounceMinutes: 30,
      });
    }
    if (
      typeof batteryLevel === "number" &&
      !isCharging &&
      batteryLevel * 100 <= alertSettings.lowBatteryPercent &&
      (previous.batteryLevel == null || previous.batteryLevel * 100 > alertSettings.lowBatteryPercent)
    ) {
      await raiseAlert({
        ...base,
        type: "low_battery",
        message: `The driver's phone battery is at ${Math.round(batteryLevel * 100)}% — tracking will stop if it dies.`,
        debounceMinutes: 120,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to record device status" });
  }
}

const SENSOR_EVENT_TYPES = ["harsh_braking", "harsh_acceleration", "harsh_cornering", "phone_use"];
const SENSOR_EVENT_MESSAGES = {
  harsh_braking: (e) => `Harsh braking detected by the phone's motion sensor (${e.value ?? "?"} g).`,
  harsh_acceleration: (e) => `Harsh acceleration detected by the phone's motion sensor (${e.value ?? "?"} g).`,
  harsh_cornering: (e) => `Sharp cornering detected by the phone's motion sensor (${e.value ?? "?"} g).`,
  phone_use: (e) =>
    `Driver used the phone while driving${e.speedKph ? ` at ${e.speedKph} km/h` : ""}${e.value ? ` for ${e.value}s` : ""}.`,
};

// DRIVER — unsafe-driving incidents the phone itself detected: motion-sensor
// g-forces (braking, acceleration, cornering) and screen use while moving.
// Accepts a batch so events buffered offline arrive with their real times.
export async function reportDrivingEvents(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id } });
    if (!vehicle) return res.status(400).json({ error: "No vehicle is assigned to you yet" });

    const events = Array.isArray(req.body.events) ? req.body.events.slice(0, 200) : [];
    let accepted = 0;
    for (const e of events) {
      if (!SENSOR_EVENT_TYPES.includes(e.type)) continue;
      const at = resolveRecordedAt(e.recordedAt);
      if (!at) continue;
      const created = await recordDrivingEvent({
        vehicle,
        type: e.type,
        source: e.type === "phone_use" ? "app" : "sensor",
        value: typeof e.value === "number" ? Math.round(e.value * 100) / 100 : null,
        speedKph: typeof e.speedKph === "number" ? Math.round(e.speedKph) : null,
        latitude: typeof e.latitude === "number" ? e.latitude : undefined,
        longitude: typeof e.longitude === "number" ? e.longitude : undefined,
        at,
      });
      if (!created) continue;
      accepted += 1;
      await raiseAlert({
        companyId: vehicle.companyId,
        vehicleId: vehicle.id,
        type: e.type,
        message: SENSOR_EVENT_MESSAGES[e.type]({ ...e, value: created.value, speedKph: created.speedKph }),
        at,
      });
    }
    return res.status(201).json({ accepted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to record driving events" });
  }
}

// DRIVER — what the app needs to decide when and how to track: the
// company's tracking hours, whether the driver has accepted tracking
// consent yet, and the battery threshold it should warn at.
export async function getTrackingConfig(req, res) {
  try {
    const [vehicle, user] = await Promise.all([
      prisma.vehicle.findFirst({ where: { driverId: req.user.id }, select: { id: true, companyId: true, plateNumber: true } }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { consentVersion: true, consentAcceptedAt: true, companyId: true },
      }),
    ]);
    const companyId = vehicle?.companyId || user?.companyId;
    const settings = companyId ? await getCompanySettings(companyId) : null;
    return res.json({
      vehicleId: vehicle?.id ?? null,
      plateNumber: vehicle?.plateNumber ?? null,
      trackingHours: settings?.trackingHours ?? { enabled: false },
      withinTrackingHours: settings ? isWithinTrackingHours(settings.trackingHours) : true,
      lowBatteryPercent: settings?.alertSettings.lowBatteryPercent ?? 15,
      consent: {
        requiredVersion: TRACKING_CONSENT_VERSION,
        acceptedVersion: user?.consentVersion ?? null,
        acceptedAt: user?.consentAcceptedAt ?? null,
      },
      dataRetentionDays: settings?.dataRetentionDays ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load tracking settings" });
  }
}

// Scheduled (index.js) — flags vehicles whose phone/tracker has gone silent
// for longer than the company's offlineMinutes while a driver is assigned
// and inside tracking hours. One alert per silence (device.offlineAlertedAt
// is cleared by the next ping or heartbeat). Catches the cases the phone
// can't report itself: app force-closed, phone switched off, battery died.
export async function sweepOfflineDevices() {
  const assigned = await prisma.vehicle.findMany({
    where: { driverId: { not: null } },
    select: { id: true, companyId: true, plateNumber: true, device: true, status: true, statusManuallySet: true },
  });
  const vehicles = assigned.filter((v) => v.device?.lastSeenAt);
  let flagged = 0;
  for (const v of vehicles) {
    if (v.device?.offlineAlertedAt) continue;
    if (v.device?.isSharing === false) continue; // driver deliberately stopped — already alerted as tracking_stopped
    const settings = await getCompanySettings(v.companyId);
    if (!isWithinTrackingHours(settings.trackingHours)) continue;
    const silentMinutes = (Date.now() - new Date(v.device.lastSeenAt).getTime()) / 60000;
    if (silentMinutes < settings.alertSettings.offlineMinutes) continue;

    await raiseAlert({
      companyId: v.companyId,
      vehicleId: v.id,
      type: "device_offline",
      message: `No signal from ${v.plateNumber} for ${Math.round(silentMinutes)} minutes — the app may have been closed, the phone switched off, or the battery died.`,
      debounceMinutes: 0,
    });
    await prisma.vehicle.update({
      where: { id: v.id },
      data: {
        device: { ...v.device, offlineAlertedAt: new Date().toISOString() },
        ...(v.statusManuallySet ? {} : { status: "offline" }),
      },
    });
    flagged += 1;
  }
  return flagged;
}

const HISTORY_MAX_POINTS = 5000;
const HISTORY_MAX_RANGE_DAYS = 31;

// ADMIN/COMPANY_OWNER — replay any vehicle's movement over a chosen date
// and time range (not just one trip), with stops detected along the way.
export async function getLocationHistory(req, res) {
  try {
    const { vehicleId } = req.query;
    const from = new Date(req.query.from);
    const to = new Date(req.query.to);
    if (!vehicleId || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      return res.status(400).json({ error: "vehicleId, from and to (ISO dates, from before to) are required" });
    }
    if (to - from > HISTORY_MAX_RANGE_DAYS * 86400000) {
      return res.status(400).json({ error: `Pick a range of ${HISTORY_MAX_RANGE_DAYS} days or less` });
    }
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: String(vehicleId), ...tenantScope(req) },
      select: { plateNumber: true },
    });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const pings = await prisma.locationPing.findMany({
      where: { vehicleId: String(vehicleId), recordedAt: { gte: from, lte: to } },
      select: { latitude: true, longitude: true, speedKph: true, heading: true, recordedAt: true, isMocked: true, accuracyM: true },
      orderBy: { recordedAt: "asc" },
      take: HISTORY_MAX_POINTS + 1,
    });
    const truncated = pings.length > HISTORY_MAX_POINTS;
    const points = truncated ? pings.slice(0, HISTORY_MAX_POINTS) : pings;
    const summary = analyzePings(points);

    return res.json({
      vehicleId,
      plateNumber: vehicle.plateNumber,
      from,
      to,
      truncated,
      // Drawn from the cleaned, smoothed track; the stops and times above
      // come from every recorded point.
      points: cleanTrack(points).map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        speedKph: p.speedKph ?? null,
        heading: p.heading ?? null,
        recordedAt: p.recordedAt,
        isMocked: !!p.isMocked,
      })),
      ...summary,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load location history" });
  }
}

// GET /api/tracking/address?lat=&lng= — street address for a position,
// shown on the Live Map's vehicle card.
export async function getAddress(req, res) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: "lat and lng must be valid coordinates" });
  }
  try {
    const address = await reverseGeocode(lat, lng);
    return res.json({ address });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Address lookup failed" });
  }
}
