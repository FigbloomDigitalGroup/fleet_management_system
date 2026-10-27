import Trip from "../models/Trip.js";
import Vehicle from "../models/Vehicle.js";
import { tenantScope } from "../middleware/auth.js";
import LocationPing from "../models/LocationPing.js";
import { sumTripDistanceKm } from "../lib/geo.js";

// List trips for the requester's tenant, newest first. Optionally narrowed
// to a single vehicle via ?vehicleId= — still constrained to vehicles the
// requester's tenant actually owns, even if a foreign id is passed — and to
// trips that started within ?from=&to= (ISO dates). Without a range it's
// the latest 100; with one, up to 1000.
export async function listTrips(req, res) {
  try {
    const vehicles = await Vehicle.find(tenantScope(req)).select("_id");
    const vehicleIds = vehicles.map((v) => v._id);

    const scopedVehicleIds = req.query.vehicleId
      ? vehicleIds.filter((v) => String(v) === req.query.vehicleId)
      : vehicleIds;

    const query = { vehicleId: { $in: scopedVehicleIds } };
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ error: "from and to must be valid dates" });
    }
    if (from || to) {
      query.startTime = {};
      if (from) query.startTime.$gte = from;
      if (to) query.startTime.$lte = to;
    }

    const trips = await Trip.find(query)
      .populate("vehicleId", "plateNumber avgConsumptionLPer100Km")
      .populate("driverId", "fullName")
      .sort({ startTime: -1 })
      .limit(from || to ? 1000 : 100);

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

// ---------------------------------------------------------------------------
// Driver trip controls (the app's "Current trip" card). Trips still start
// on their own when the vehicle moves; these let the driver tag the trip in
// progress and end it without waiting for the idle timeout.

const TRIP_PURPOSES = ["business", "private"];

// Validates the optional purpose/note fields; returns an error string or the
// fields to set.
function tripDetailsFromBody(body) {
  const update = {};
  if (body.purpose !== undefined) {
    if (body.purpose !== null && !TRIP_PURPOSES.includes(body.purpose)) {
      return { error: `purpose must be one of: ${TRIP_PURPOSES.join(", ")}` };
    }
    update.purpose = body.purpose;
  }
  if (body.note !== undefined) {
    if (typeof body.note !== "string" || body.note.length > 500) {
      return { error: "note must be text of at most 500 characters" };
    }
    update.note = body.note.trim();
  }
  return { update };
}

async function findMyOpenTrip(driverId) {
  const vehicle = await Vehicle.findOne({ driverId });
  if (!vehicle) return { vehicle: null, trip: null };
  const trip = await Trip.findOne({ vehicleId: vehicle._id, endTime: { $exists: false } }).sort({ startTime: -1 });
  return { vehicle, trip };
}

async function tripPingsUpTo(trip, until) {
  return LocationPing.find({ vehicleId: trip.vehicleId, recordedAt: { $gte: trip.startTime, $lte: until } })
    .select("latitude longitude recordedAt")
    .sort({ recordedAt: 1 });
}

// GET /api/trips/me/current — the driver's trip in progress (or null), with
// the distance covered so far.
export async function getMyCurrentTrip(req, res) {
  try {
    const { trip } = await findMyOpenTrip(req.user.id);
    if (!trip) return res.json(null);

    const pings = await tripPingsUpTo(trip, new Date());
    return res.json({
      _id: trip._id,
      startTime: trip.startTime,
      purpose: trip.purpose,
      note: trip.note,
      distanceKm: Math.round(sumTripDistanceKm(pings) * 10) / 10,
      lastUpdateAt: pings.length ? pings[pings.length - 1].recordedAt : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your current trip" });
  }
}

// PATCH /api/trips/me/current — set the trip's purpose and/or note.
export async function updateMyCurrentTrip(req, res) {
  try {
    const { error, update } = tripDetailsFromBody(req.body);
    if (error) return res.status(400).json({ error });

    const { trip } = await findMyOpenTrip(req.user.id);
    if (!trip) return res.status(404).json({ error: "You don't have a trip in progress" });

    Object.assign(trip, update);
    await trip.save();
    return res.json({ _id: trip._id, purpose: trip.purpose, note: trip.note });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update your trip" });
  }
}

// POST /api/trips/me/current/end — ends the trip now. It ends at the moment
// the driver pressed the button, so points the phone buffered before that
// still count towards it when they upload; movement afterwards starts a new
// trip rather than reopening this one.
export async function endMyCurrentTrip(req, res) {
  try {
    const { error, update } = tripDetailsFromBody(req.body);
    if (error) return res.status(400).json({ error });

    const { trip } = await findMyOpenTrip(req.user.id);
    if (!trip) return res.status(404).json({ error: "You don't have a trip in progress" });

    const endTime = new Date();
    const pings = await tripPingsUpTo(trip, endTime);
    const last = pings[pings.length - 1];

    Object.assign(trip, update);
    trip.endTime = endTime;
    trip.endLat = last ? last.latitude : trip.startLat;
    trip.endLng = last ? last.longitude : trip.startLng;
    trip.distanceKm = Math.round(sumTripDistanceKm(pings) * 10) / 10;
    trip.endedBy = "driver";
    await trip.save();

    return res.json(trip);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to end your trip" });
  }
}
