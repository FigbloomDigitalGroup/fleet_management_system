import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { sumTripDistanceKm } from "../lib/geo.js";

// What the Mongo version populated: vehicleId → plate + mileage.
const TRIP_VEHICLE = { select: { id: true, plateNumber: true, avgConsumptionLPer100Km: true } };

// Ids of the vehicles the requester's tenant owns.
async function scopedVehicleIds(req) {
  const vehicles = await prisma.vehicle.findMany({ where: tenantScope(req), select: { id: true } });
  return vehicles.map((v) => v.id);
}

// List trips for the requester's tenant, newest first. Optionally narrowed
// to a single vehicle via ?vehicleId= — still constrained to vehicles the
// requester's tenant actually owns, even if a foreign id is passed — and to
// trips that started within ?from=&to= (ISO dates). Without a range it's
// the latest 100; with one, up to 1000.
export async function listTrips(req, res) {
  try {
    const vehicleIds = await scopedVehicleIds(req);
    const allowedIds = req.query.vehicleId ? vehicleIds.filter((v) => v === req.query.vehicleId) : vehicleIds;

    const where = { vehicleId: { in: allowedIds } };
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ error: "from and to must be valid dates" });
    }
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = from;
      if (to) where.startTime.lte = to;
    }

    const trips = await prisma.trip.findMany({
      where,
      include: { vehicle: TRIP_VEHICLE, driver: { select: { id: true, fullName: true, avatarUploadId: true } } },
      orderBy: { startTime: "desc" },
      take: from || to ? 1000 : 100,
    });

    return res.json(toApi(trips));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch trips" });
  }
}

export async function getTrip(req, res) {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.id, vehicleId: { in: await scopedVehicleIds(req) } },
      include: { vehicle: TRIP_VEHICLE, driver: { select: { id: true, fullName: true, email: true, avatarUploadId: true } } },
    });

    if (!trip) return res.status(404).json({ error: "Trip not found" });

    return res.json(toApi(trip));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch trip" });
  }
}

export async function getTripPath(req, res) {
  try {
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, vehicleId: { in: await scopedVehicleIds(req) } } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const pings = await prisma.locationPing.findMany({
      where: { vehicleId: trip.vehicleId, recordedAt: { gte: trip.startTime, lte: trip.endTime || new Date() } },
      orderBy: { recordedAt: "asc" },
    });

    return res.json(toApi(pings));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch trip path" });
  }
}

export async function listMyTrips(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id }, select: { id: true } });
    if (!vehicle) return res.json([]);

    const trips = await prisma.trip.findMany({
      where: { vehicleId: vehicle.id },
      include: { vehicle: TRIP_VEHICLE },
      orderBy: { startTime: "desc" },
      take: 50,
    });

    return res.json(toApi(trips));
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
  const vehicle = await prisma.vehicle.findFirst({ where: { driverId } });
  if (!vehicle) return { vehicle: null, trip: null };
  const trip = await prisma.trip.findFirst({ where: { vehicleId: vehicle.id, endTime: null }, orderBy: { startTime: "desc" } });
  return { vehicle, trip };
}

async function tripPingsUpTo(trip, until) {
  return prisma.locationPing.findMany({
    where: { vehicleId: trip.vehicleId, recordedAt: { gte: trip.startTime, lte: until } },
    select: { latitude: true, longitude: true, recordedAt: true },
    orderBy: { recordedAt: "asc" },
  });
}

// GET /api/trips/me/current — the driver's trip in progress (or null), with
// the distance covered so far.
export async function getMyCurrentTrip(req, res) {
  try {
    const { trip } = await findMyOpenTrip(req.user.id);
    if (!trip) return res.json(null);

    const pings = await tripPingsUpTo(trip, new Date());
    return res.json({
      _id: trip.id,
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

    const updated = await prisma.trip.update({ where: { id: trip.id }, data: update });
    return res.json({ _id: updated.id, purpose: updated.purpose, note: updated.note });
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

    const ended = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        ...update,
        endTime,
        endLat: last ? last.latitude : trip.startLat,
        endLng: last ? last.longitude : trip.startLng,
        distanceKm: Math.round(sumTripDistanceKm(pings) * 10) / 10,
        endedBy: "driver",
      },
    });

    return res.json(toApi(ended));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to end your trip" });
  }
}
