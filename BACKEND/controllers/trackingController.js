import Vehicle from "../models/Vehicle.js";
import LocationPing from "../models/LocationPing.js";
import Trip from "../models/Trip.js";
import Alert from "../models/Alert.js";
import { tenantScope } from "../middleware/auth.js";

const SPEEDING_LIMIT_KPH = 80;
const TRIP_IDLE_TIMEOUT_MINUTES = 5; // no movement for this long = trip ends

// Haversine distance between two lat/lng points, in km
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

export async function ingestLocation(req, res) {
  try {
    const { vehicleId, latitude, longitude, speedKph, heading } = req.body;
    if (!vehicleId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "vehicleId, latitude, and longitude are required" });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const isMoving = speedKph && speedKph > 2;

    // 1. Save the raw ping (always happens, same as before)
    const ping = await LocationPing.create({ vehicleId, latitude, longitude, speedKph, heading });

    // 2. Update vehicle status
    vehicle.status = isMoving ? "active" : "idle";
    await vehicle.save();

    // 3. Find an "open" trip for this vehicle (no endTime yet)
    let openTrip = await Trip.findOne({ vehicleId, endTime: { $exists: false } }).sort({ startTime: -1 });

    if (isMoving && !openTrip) {
      // Vehicle started moving with no open trip — start a new one
      openTrip = await Trip.create({
        vehicleId,
        driverId: vehicle.driverId || null,
        startTime: new Date(),
        startLat: latitude,
        startLng: longitude,
      });
    } else if (!isMoving && openTrip) {
      // Vehicle has stopped — check how long it's been idle before closing the trip
      const lastPing = await LocationPing.findOne({ vehicleId })
        .sort({ recordedAt: -1 })
        .skip(1); // the ping before this one

      const minutesSinceLastMovement = lastPing
        ? (Date.now() - new Date(lastPing.recordedAt).getTime()) / 60000
        : 0;

      if (minutesSinceLastMovement >= TRIP_IDLE_TIMEOUT_MINUTES || !lastPing) {
        // Calculate total distance across all pings in this trip
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

    // 4. Speeding alert
    if (speedKph && speedKph > SPEEDING_LIMIT_KPH) {
      await Alert.create({
        companyId: vehicle.companyId,
        vehicleId,
        type: "speeding",
        message: `Vehicle recorded at ${speedKph} km/h, exceeding the ${SPEEDING_LIMIT_KPH} km/h limit.`,
      });
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