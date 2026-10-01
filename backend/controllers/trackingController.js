import Vehicle from "../models/Vehicle.js";
import LocationPing from "../models/LocationPing.js";
import Trip from "../models/Trip.js";
import Alert from "../models/Alert.js";
import Route from "../models/Route.js";
import Geofence from "../models/Geofence.js";
import { tenantScope } from "../middleware/auth.js";
import { distanceKm, isInsideGeofence } from "../lib/geo.js";

const SPEEDING_LIMIT_KPH = 80;
const TRIP_IDLE_TIMEOUT_MINUTES = 5;
const FUEL_ANOMALY_THRESHOLD_PCT = 50;
const HARSH_BRAKING_KPH_PER_SEC = 8; // deceleration rate considered harsh braking
const HARSH_ACCELERATION_KPH_PER_SEC = 6; // acceleration rate considered harsh acceleration
const EXCESSIVE_IDLE_MINUTES = 10; // continuous idle time considered excessive

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

export async function ingestLocation(req, res) {
  try {
    const { vehicleId, latitude, longitude, speedKph, heading, fuelLevelLiters } = req.body;
    if (!vehicleId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "vehicleId, latitude, and longitude are required" });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const isMoving = speedKph && speedKph > 2;

    // Get the previous ping BEFORE saving the new one — needed for fuel + geofence comparisons
    const previousPing = await LocationPing.findOne({ vehicleId }).sort({ recordedAt: -1 });

    // 1. Save the raw ping
    const ping = await LocationPing.create({
      vehicleId,
      latitude,
      longitude,
      speedKph,
      heading,
      fuelLevelLiters: fuelLevelLiters ?? null,
    });


// 2. Update vehicle status — but never "active" without a driver assigned
if (!vehicle.driverId) {
  vehicle.status = "offline";
  vehicle.statusManuallySet = false;

  // Flag it if the vehicle is actually moving with nobody assigned to it
  if (isMoving) {
    await Alert.create({
      companyId: vehicle.companyId,
      vehicleId,
      type: "unauthorized_movement",
      message: `Vehicle is moving at ${speedKph} km/h with no driver assigned.`,
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
await vehicle.save();

// 2b. Excessive idling — only meaningful with a driver assigned (unassigned
// + moving is already handled above as unauthorized_movement). De-duplicated
// per idle streak by checking for an existing alert since the vehicle last
// moved, so this doesn't fire again on every subsequent ping.
if (vehicle.driverId && !isMoving) {
  const lastMovingPing = await LocationPing.findOne({ vehicleId, speedKph: { $gt: 2 } }).sort({ recordedAt: -1 });
  const idleStartedAt = lastMovingPing ? new Date(lastMovingPing.recordedAt) : vehicle.createdAt;
  const idleMinutes = (Date.now() - idleStartedAt.getTime()) / 60000;

  if (idleMinutes >= EXCESSIVE_IDLE_MINUTES) {
    const alreadyAlerted = await Alert.findOne({
      vehicleId,
      type: "excessive_idling",
      createdAt: { $gte: idleStartedAt },
    });

    if (!alreadyAlerted) {
      await Alert.create({
        companyId: vehicle.companyId,
        vehicleId,
        type: "excessive_idling",
        message: `Vehicle has been idling for over ${EXCESSIVE_IDLE_MINUTES} minutes.`,
      });
    }
  }
}


    // 3. Trip start/end logic
    let openTrip = await Trip.findOne({ vehicleId, endTime: { $exists: false } }).sort({ startTime: -1 });

    if (isMoving && !openTrip) {
      openTrip = await Trip.create({
        vehicleId,
        driverId: vehicle.driverId || null,
        startTime: new Date(),
        startLat: latitude,
        startLng: longitude,
      });
    } else if (!isMoving && openTrip) {
      const lastPing = await LocationPing.findOne({ vehicleId }).sort({ recordedAt: -1 }).skip(1);
      const minutesSinceLastMovement = lastPing
        ? (Date.now() - new Date(lastPing.recordedAt).getTime()) / 60000
        : 0;

      if (minutesSinceLastMovement >= TRIP_IDLE_TIMEOUT_MINUTES || !lastPing) {
        const tripPings = await LocationPing.find({
          vehicleId,
          recordedAt: { $gte: openTrip.startTime },
        }).sort({ recordedAt: 1 });

        let totalDistance = 0;
        for (let i = 1; i < tripPings.length; i++) {
          totalDistance += distanceKm(
            tripPings[i - 1].latitude,
            tripPings[i - 1].longitude,
            tripPings[i].latitude,
            tripPings[i].longitude
          );
        }

        openTrip.endTime = new Date();
        openTrip.endLat = latitude;
        openTrip.endLng = longitude;
        openTrip.distanceKm = Math.round(totalDistance * 10) / 10;
        await openTrip.save();
      }
    }

    // 4. Speeding alert (route-specific limit overrides company default, if a route is assigned)
    const activeRoute = await Route.findOne({ vehicleId, active: true });
    const speedLimit = activeRoute?.speedLimitKph || SPEEDING_LIMIT_KPH;

    if (speedKph && speedKph > speedLimit) {
      await Alert.create({
        companyId: vehicle.companyId,
        vehicleId,
        type: "speeding",
        message: `Vehicle recorded at ${speedKph} km/h, exceeding the ${speedLimit} km/h limit.`,
      });
    }

    // 4b. Harsh braking / harsh acceleration — derived from the speed delta
    // between this ping and the previous one (the tracker only reports
    // position/speed, same as the mobile app — no accelerometer hardware).
    if (previousPing && speedKph !== undefined && speedKph !== null && previousPing.speedKph != null) {
      const deltaSeconds = (ping.recordedAt.getTime() - new Date(previousPing.recordedAt).getTime()) / 1000;

      if (deltaSeconds >= 1 && deltaSeconds <= 30) {
        const ratePerSec = (speedKph - previousPing.speedKph) / deltaSeconds;

        if (ratePerSec <= -HARSH_BRAKING_KPH_PER_SEC) {
          await Alert.create({
            companyId: vehicle.companyId,
            vehicleId,
            type: "harsh_braking",
            message: `Harsh braking detected: dropped from ${previousPing.speedKph} km/h to ${speedKph} km/h in ${deltaSeconds.toFixed(0)}s.`,
          });
        } else if (ratePerSec >= HARSH_ACCELERATION_KPH_PER_SEC) {
          await Alert.create({
            companyId: vehicle.companyId,
            vehicleId,
            type: "harsh_acceleration",
            message: `Harsh acceleration detected: rose from ${previousPing.speedKph} km/h to ${speedKph} km/h in ${deltaSeconds.toFixed(0)}s.`,
          });
        }
      }
    }

    // 5. Route deviation detection — only runs if this vehicle has an assigned route
    if (activeRoute && activeRoute.waypoints.length > 0) {
      const deviationKm = distanceToRouteKm(latitude, longitude, activeRoute.waypoints);
      const toleranceKm = activeRoute.toleranceMeters / 1000;

      if (deviationKm !== null && deviationKm > toleranceKm) {
        await Alert.create({
          companyId: vehicle.companyId,
          vehicleId,
          type: "route_deviation",
          message: `Vehicle is ${(deviationKm * 1000).toFixed(0)}m off its assigned route "${activeRoute.name}" (allowed: ${activeRoute.toleranceMeters}m).`,
        });
      }
    }

    // 6. Fuel anomaly detection — only runs if we have fuel data on both this ping and the previous one
    if (
      fuelLevelLiters !== undefined &&
      fuelLevelLiters !== null &&
      previousPing &&
      previousPing.fuelLevelLiters !== null &&
      previousPing.fuelLevelLiters !== undefined
    ) {
      const distanceSinceLastPingKm = distanceKm(
        previousPing.latitude,
        previousPing.longitude,
        latitude,
        longitude
      );
      const fuelDropLiters = previousPing.fuelLevelLiters - fuelLevelLiters;

      if (distanceSinceLastPingKm > 0.5 && fuelDropLiters > 0) {
        const expectedDropLiters = (vehicle.avgConsumptionLPer100Km / 100) * distanceSinceLastPingKm;
        const percentOverExpected =
          expectedDropLiters > 0 ? ((fuelDropLiters - expectedDropLiters) / expectedDropLiters) * 100 : 0;

        if (percentOverExpected > FUEL_ANOMALY_THRESHOLD_PCT) {
          await Alert.create({
            companyId: vehicle.companyId,
            vehicleId,
            type: "fuel_anomaly",
            message: `Unusual fuel consumption: used ${fuelDropLiters.toFixed(1)}L over ${distanceSinceLastPingKm.toFixed(1)}km, ${percentOverExpected.toFixed(0)}% more than expected for this vehicle.`,
          });
        }
      }
    }

    // 7. Geofence entry/exit detection
    const geofences = await Geofence.find({ companyId: vehicle.companyId });

    for (const geofence of geofences) {
      const isInsideNow = isInsideGeofence(latitude, longitude, geofence);

      let wasInsideBefore = false;
      if (previousPing) {
        wasInsideBefore = isInsideGeofence(previousPing.latitude, previousPing.longitude, geofence);
      }

      if (isInsideNow && !wasInsideBefore) {
        await Alert.create({
          companyId: vehicle.companyId,
          vehicleId,
          type: "geofence_entry",
          message: `Vehicle entered geofence "${geofence.name}".`,
        });
      } else if (!isInsideNow && wasInsideBefore) {
        await Alert.create({
          companyId: vehicle.companyId,
          vehicleId,
          type: "geofence_exit",
          message: `Vehicle exited geofence "${geofence.name}".`,
        });
      }
    }

    return res.status(201).json(ping);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to record location ping" });
  }
}

// Closes out trips whose vehicle has simply gone quiet — a real tracker (or
// the dev-ping live simulator) often stops sending pings entirely once a
// vehicle parks, rather than continuing to report speed=0. The trip-closing
// logic above only runs reactively when a new ping arrives, so without this
// sweep those trips would stay open forever and never show up anywhere that
// only lists completed trips (e.g. VehicleTripsMap). Runs on a schedule from
// Index.js, independent of any single vehicle's ping stream.
export async function closeStaleTrips() {
  const openTrips = await Trip.find({ endTime: { $exists: false } });
  let closedCount = 0;

  for (const trip of openTrips) {
    const lastPing = await LocationPing.findOne({ vehicleId: trip.vehicleId }).sort({ recordedAt: -1 });
    if (!lastPing) continue;

    const minutesSinceLastPing = (Date.now() - new Date(lastPing.recordedAt).getTime()) / 60000;
    if (minutesSinceLastPing < TRIP_IDLE_TIMEOUT_MINUTES) continue;

    const tripPings = await LocationPing.find({
      vehicleId: trip.vehicleId,
      recordedAt: { $gte: trip.startTime },
    }).sort({ recordedAt: 1 });

    let totalDistance = 0;
    for (let i = 1; i < tripPings.length; i++) {
      totalDistance += distanceKm(
        tripPings[i - 1].latitude,
        tripPings[i - 1].longitude,
        tripPings[i].latitude,
        tripPings[i].longitude
      );
    }

    const finalPing = tripPings[tripPings.length - 1] || lastPing;
    trip.endTime = finalPing.recordedAt;
    trip.endLat = finalPing.latitude;
    trip.endLng = finalPing.longitude;
    trip.distanceKm = Math.round(totalDistance * 10) / 10;
    await trip.save();
    closedCount += 1;
  }

  return closedCount;
}

export async function getLiveLocations(req, res) {
  try {
    const vehicles = await Vehicle.find(tenantScope(req)).select("plateNumber status vehicleType");
    const results = await Promise.all(
      vehicles.map(async (v) => {
        const lastPing = await LocationPing.findOne({ vehicleId: v._id }).sort({ recordedAt: -1 });
        return {
          vehicleId: v._id,
          plateNumber: v.plateNumber,
          status: v.status,
          vehicleType: v.vehicleType,
          lastLocation: lastPing || null,
        };
      })
    );
    return res.json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch live locations" });
  }
}






