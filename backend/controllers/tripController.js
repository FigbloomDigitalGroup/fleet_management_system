import Trip from "../models/Trip.js";
import Vehicle from "../models/Vehicle.js";
import { tenantScope } from "../middleware/auth.js";
import LocationPing from "../models/LocationPing.js";

// List trips for the requester's tenant, newest first. Optionally narrowed
// to a single vehicle via ?vehicleId= — still constrained to vehicles the
// requester's tenant actually owns, even if a foreign id is passed.
export async function listTrips(req, res) {
  try {
    const vehicles = await Vehicle.find(tenantScope(req)).select("_id");
    const vehicleIds = vehicles.map((v) => v._id);

    const scopedVehicleIds = req.query.vehicleId
      ? vehicleIds.filter((v) => String(v) === req.query.vehicleId)
      : vehicleIds;

    const trips = await Trip.find({ vehicleId: { $in: scopedVehicleIds } })
      .populate("vehicleId", "plateNumber avgConsumptionLPer100Km")
      .populate("driverId", "fullName")
      .sort({ startTime: -1 })
      .limit(100);

    return res.json(trips);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch trips" });
  }
}

export async function getTrip(req, res) {
  try {
    const vehicles = await Vehicle.find(tenantScope(req)).select("_id");
    const vehicleIds = vehicles.map((v) => v._id);

    const trip = await Trip.findOne({ _id: req.params.id, vehicleId: { $in: vehicleIds } })
      .populate("vehicleId", "plateNumber avgConsumptionLPer100Km")
      .populate("driverId", "fullName email");

    if (!trip) return res.status(404).json({ error: "Trip not found" });

    return res.json(trip);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch trip" });
  }
}

export async function getTripPath(req, res) {
  try {
    const vehicles = await Vehicle.find(tenantScope(req)).select("_id");
    const vehicleIds = vehicles.map((v) => v._id);

    const trip = await Trip.findOne({ _id: req.params.id, vehicleId: { $in: vehicleIds } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const pings = await LocationPing.find({
      vehicleId: trip.vehicleId,
      recordedAt: {
        $gte: trip.startTime,
        $lte: trip.endTime || new Date(),
      },
    }).sort({ recordedAt: 1 });

    return res.json(pings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch trip path" });
  }
}

export async function listMyTrips(req, res) {
  try {
    const vehicle = await Vehicle.findOne({ driverId: req.user.id });
    if (!vehicle) return res.json([]);

    const trips = await Trip.find({ vehicleId: vehicle._id })
      .populate("vehicleId", "plateNumber avgConsumptionLPer100Km")
      .sort({ startTime: -1 })
      .limit(50);

    return res.json(trips);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your trips" });
  }
}



