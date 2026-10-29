import prisma from "./prisma.js";
import { cleanTrack } from "./gpsFilter.js";
import { matchRoadLine } from "../services/mapMatching.js";

// A trip's drawable path: its pings cleaned and smoothed (lib/gpsFilter.js)
// and, once the trip has ended, moved onto the roads it followed (OSRM, see
// services/mapMatching.js). Matching runs in the background after a trip
// ends and is saved on the trip (roadPath), so viewing a trip never waits
// for it. Shape: { points: [{ latitude, longitude, speedKph, heading,
// recordedAt }], geometry: [{ lat, lng }] | null, snapped }.

// A cleaned point further than this from the matched road is left where it
// is (e.g. a car park or a road OSRM doesn't know).
const MAX_SNAP_M = 60;
// How far along the road line to look for each next point.
const SEARCH_WINDOW = 400;

const shape = (points) =>
  points.map((p) => ({ latitude: p.latitude, longitude: p.longitude, speedKph: p.speedKph, heading: p.heading, recordedAt: p.recordedAt }));

async function cleanedPoints(trip) {
  const pings = await prisma.locationPing.findMany({
    where: { vehicleId: trip.vehicleId, recordedAt: { gte: trip.startTime, lte: trip.endTime || new Date() } },
    select: { latitude: true, longitude: true, speedKph: true, heading: true, recordedAt: true, accuracyM: true, isMocked: true },
    orderBy: { recordedAt: "asc" },
  });
  return cleanTrack(pings);
}

// Moves each point onto the nearest spot of the road line, walking forward
// along the line as the trip goes (flat-earth maths is fine at this scale).
function placeOnRoad(points, line) {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = kmPerDegLat * Math.cos((line[0].lat * Math.PI) / 180);
  const toXY = (lat, lng) => [lng * kmPerDegLng * 1000, lat * kmPerDegLat * 1000];
  const xy = line.map((p) => toXY(p.lat, p.lng));
  let from = 0;
  return points.map((p) => {
    const [px, py] = toXY(p.latitude, p.longitude);
    let best = null;
    for (let i = from; i < Math.min(xy.length - 1, from + SEARCH_WINDOW); i++) {
      const [ax, ay] = xy[i];
      const [bx, by] = xy[i + 1];
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2)) : 0;
      const qx = ax + t * (bx - ax);
      const qy = ay + t * (by - ay);
      const d = Math.hypot(px - qx, py - qy);
      if (!best || d < best.d) best = { d, i, t };
    }
    if (!best || best.d > MAX_SNAP_M) return p;
    from = best.i;
    const a = line[best.i];
    const b = line[best.i + 1];
    return { ...p, latitude: a.lat + best.t * (b.lat - a.lat), longitude: a.lng + best.t * (b.lng - a.lng) };
  });
}

// Matches one finished trip and saves the result. Returns the road path,
// or null if the trip changed meanwhile or matching failed.
async function buildRoadPath(tripId) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip?.endTime || trip.roadPath) return trip?.roadPath ?? null;
  const points = await cleanedPoints(trip);
  if (points.length < 2) return null;
  try {
    const geometry = await matchRoadLine(points);
    const roadPath = { points: shape(placeOnRoad(points, geometry)), geometry, snapped: true };
    // Only if the trip still ends where it did — a reopened trip is redone later.
    const { count } = await prisma.trip.updateMany({ where: { id: trip.id, endTime: trip.endTime }, data: { roadPath } });
    return count ? roadPath : null;
  } catch (err) {
    console.warn(`[map matching] trip ${trip.id}: ${err.message}`);
    return null;
  }
}

// Background queue — one trip at a time, so the OSRM server isn't flooded.
const queue = [];
const queued = new Set();
let running = false;

export function queueRoadPath(tripId) {
  if (queued.has(tripId)) return;
  queued.add(tripId);
  queue.push(tripId);
  if (running) return;
  running = true;
  (async () => {
    while (queue.length) {
      const id = queue.shift();
      await buildRoadPath(id).catch((err) => console.warn(`[map matching] trip ${id}: ${err.message}`));
      queued.delete(id);
    }
    running = false;
  })();
}

// The path to draw now: the saved road path if there is one, otherwise the
// cleaned track (and a finished trip is queued for matching).
export async function tripPath(trip) {
  if (trip.roadPath) return trip.roadPath;
  if (trip.endTime) queueRoadPath(trip.id);
  return { points: shape(await cleanedPoints(trip)), geometry: null, snapped: false };
}
