import { distanceKm } from "./geo.js";

// Straight-line distance understates real roads; this factor and the
// average urban speed turn it into a usable drive-time estimate.
export const ROAD_FACTOR = 1.3;
export const AVG_SPEED_KPH = 30;
const SERVICE_MINUTES = 10; // time spent at each stop
const LATE_PENALTY_KM_PER_MIN = 2; // how much a minute of lateness "costs" vs driving further

export function driveMinutes(fromLat, fromLng, toLat, toLng) {
  return ((distanceKm(fromLat, fromLng, toLat, toLng) * ROAD_FACTOR) / AVG_SPEED_KPH) * 60;
}

// Walks a candidate order from `start`, returning road km plus a penalty for
// every minute a stop is reached after its time window closes (and waiting
// time if it's reached before the window opens).
function evaluate(order, start, startTime) {
  let km = 0;
  let lateMinutes = 0;
  let clock = startTime.getTime();
  let pos = start;
  for (const job of order) {
    const legKm = distanceKm(pos.lat, pos.lng, job.latitude, job.longitude) * ROAD_FACTOR;
    km += legKm;
    clock += (legKm / AVG_SPEED_KPH) * 3600000;
    if (job.windowStart && clock < new Date(job.windowStart).getTime()) clock = new Date(job.windowStart).getTime();
    if (job.windowEnd && clock > new Date(job.windowEnd).getTime()) {
      lateMinutes += (clock - new Date(job.windowEnd).getTime()) / 60000;
    }
    clock += SERVICE_MINUTES * 60000;
    pos = { lat: job.latitude, lng: job.longitude };
  }
  return { km, lateMinutes, cost: km + lateMinutes * LATE_PENALTY_KM_PER_MIN, finishAt: new Date(clock) };
}

// Orders stops for one driver: greedy nearest-neighbour (preferring stops
// whose windows close soonest) followed by 2-opt improvement. Good results
// for the tens-of-stops-per-day a fleet driver does, with no external API.
export function optimizeStops(jobs, start, startTime = new Date()) {
  if (jobs.length <= 1) return { order: [...jobs], ...evaluate(jobs, start, startTime) };

  const remaining = [...jobs];
  const order = [];
  let pos = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestScore = Infinity;
    remaining.forEach((job, i) => {
      const km = distanceKm(pos.lat, pos.lng, job.latitude, job.longitude);
      const urgency = job.windowEnd ? Math.max(0, (new Date(job.windowEnd) - startTime) / 3600000) : 24;
      const score = km + urgency * 0.5;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    order.push(next);
    pos = { lat: next.latitude, lng: next.longitude };
  }

  let best = order;
  let bestCost = evaluate(best, start, startTime).cost;
  let improved = true;
  for (let pass = 0; improved && pass < 50; pass++) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const cost = evaluate(candidate, start, startTime).cost;
        if (cost + 1e-9 < bestCost) {
          best = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }
  return { order: best, ...evaluate(best, start, startTime) };
}
