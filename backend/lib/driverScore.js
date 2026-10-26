import mongoose from "mongoose";
import DrivingEvent from "../models/DrivingEvent.js";
import Trip from "../models/Trip.js";

// How much each kind of incident costs, per 100 km driven. Phone use is
// weighted heaviest — it's the one most strongly linked to crashes.
export const SCORE_WEIGHTS = {
  speeding: 3,
  harsh_braking: 2,
  harsh_acceleration: 2,
  harsh_cornering: 2,
  phone_use: 5,
};
const POINTS_PER_WEIGHTED_EVENT_PER_100KM = 4;
// Below this much driving the score would swing wildly on a single event.
export const MIN_SCORED_DISTANCE_KM = 10;

export function gradeFor(score) {
  if (score === null) return null;
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Needs coaching";
}

// Score 0–100 for one or many drivers over the last `days` days:
// 100 minus weighted incidents per 100 km. null when they haven't driven
// MIN_SCORED_DISTANCE_KM yet. Returns a Map keyed by driverId string.
// `endsAt` scores a past window instead (e.g. a week ago, for a trend).
export async function computeDriverScores(driverIds, days = 30, endsAt = new Date()) {
  const ids = driverIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const since = new Date(endsAt.getTime() - days * 86400000);

  const [eventRows, distanceRows] = await Promise.all([
    DrivingEvent.aggregate([
      { $match: { driverId: { $in: ids }, recordedAt: { $gte: since, $lt: endsAt } } },
      { $group: { _id: { driverId: "$driverId", type: "$type" }, count: { $sum: 1 } } },
    ]),
    Trip.aggregate([
      { $match: { driverId: { $in: ids }, startTime: { $gte: since, $lt: endsAt } } },
      {
        $group: {
          _id: "$driverId",
          distanceKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
          trips: { $sum: 1 },
        },
      },
    ]),
  ]);

  const result = new Map();
  for (const id of ids) {
    const key = String(id);
    const events = Object.fromEntries(Object.keys(SCORE_WEIGHTS).map((t) => [t, 0]));
    for (const row of eventRows) if (String(row._id.driverId) === key) events[row._id.type] = row.count;
    const dist = distanceRows.find((r) => String(r._id) === key);
    const distanceKm = Math.round((dist?.distanceKm || 0) * 10) / 10;
    const weighted = Object.entries(events).reduce((sum, [t, n]) => sum + SCORE_WEIGHTS[t] * n, 0);

    let score = null;
    if (distanceKm >= MIN_SCORED_DISTANCE_KM) {
      const per100 = weighted / (distanceKm / 100);
      score = Math.max(0, Math.min(100, Math.round(100 - per100 * POINTS_PER_WEIGHTED_EVENT_PER_100KM)));
    }
    result.set(key, {
      driverId: key,
      score,
      grade: gradeFor(score),
      periodDays: days,
      distanceKm,
      trips: dist?.trips || 0,
      events,
      totalEvents: Object.values(events).reduce((a, b) => a + b, 0),
      minDistanceKm: MIN_SCORED_DISTANCE_KM,
    });
  }
  return result;
}
