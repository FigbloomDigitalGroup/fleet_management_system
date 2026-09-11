import Vehicle from "../models/Vehicle.js";
import LocationPing from "../models/LocationPing.js";
import Trip from "../models/Trip.js";
import Alert from "../models/Alert.js";
import Route from "../models/Route.js";
import { tenantScope } from "../middleware/auth.js";

const SPEEDING_LIMIT_KPH = 80;
const TRIP_IDLE_TIMEOUT_MINUTES = 5;
const FUEL_ANOMALY_THRESHOLD_PCT = 50; // if actual fuel drop is 50%+ more than expected, flag it

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Distance in km from a point to the nearest segment of a route's waypoints
function distanceToRouteKm(lat, lng, waypoints) {
  if (!waypoints || waypoints.length === 0) return null;
  if (waypoints.length === 1) return distanceKm(lat, lng, waypoints[0].lat, waypoints[0].lng);

  let minDist = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    // Approximate: check distance to both segment endpoints (good enough at city scale,
    // avoids more complex point-to-line-segment projection math)
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

    // Get the previous ping BEFORE saving the new one — needed for fuel + distance comparisons
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

    // 2. Update vehicle status
    vehicle.status = isMoving ? "active" : "idle";
    await vehicle.save();

    // 3. Trip start/end logic (unchanged from before)
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

      // Only check if the vehicle actually moved a meaningful distance and fuel dropped at all
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

    return res.status(201).json(ping);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to record location ping" });
  }
}

export async function getLiveLocations(req, res) {
  try {
    const vehicles = await Vehicle.find(tenantScope(req)).select("plateNumber status");
    const results = await Promise.all(
      vehicles.map(async (v) => {
        const lastPing = await LocationPing.findOne({ vehicleId: v._id }).sort({ recordedAt: -1 });
        return { vehicleId: v._id, plateNumber: v.plateNumber, status: v.status, lastLocation: lastPing || null };
      })
    );
    return res.json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch live locations" });
  }
}