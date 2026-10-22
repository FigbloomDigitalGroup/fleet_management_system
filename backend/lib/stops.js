import { distanceKm } from "./geo.js";

const STATIONARY_KPH = 2;
const MIN_STOP_MINUTES = 3;
// A gap between two points longer than this is "no data", not idling or
// driving — e.g. tracking was off overnight.
const MAX_GAP_MINUTES = 10;

const isStationary = (p) => p.speedKph == null || p.speedKph <= STATIONARY_KPH;

// Turns a chronological list of pings into stops (stationary for at least
// MIN_STOP_MINUTES, with where and how long) plus moving/idle time and
// distance. Shared by trip history replay and reports.
export function analyzePings(pings) {
  const stops = [];
  let idleMinutes = 0;
  let movingMinutes = 0;
  let distance = 0;
  let runStart = null;

  const closeRun = (endPing) => {
    if (!runStart) return;
    const minutes = (new Date(endPing.recordedAt) - new Date(runStart.recordedAt)) / 60000;
    if (minutes >= MIN_STOP_MINUTES) {
      stops.push({
        startedAt: runStart.recordedAt,
        endedAt: endPing.recordedAt,
        durationMinutes: Math.round(minutes),
        latitude: runStart.latitude,
        longitude: runStart.longitude,
      });
    }
    runStart = null;
  };

  for (let i = 0; i < pings.length; i++) {
    const p = pings[i];
    const prev = pings[i - 1];
    if (prev) {
      const gap = (new Date(p.recordedAt) - new Date(prev.recordedAt)) / 60000;
      if (gap > MAX_GAP_MINUTES) {
        closeRun(prev);
      } else {
        distance += distanceKm(prev.latitude, prev.longitude, p.latitude, p.longitude);
        if (isStationary(prev)) idleMinutes += gap;
        else movingMinutes += gap;
      }
    }
    if (isStationary(p)) {
      if (!runStart) runStart = p;
    } else {
      closeRun(p);
    }
  }
  if (pings.length) closeRun(pings[pings.length - 1]);

  return {
    stops,
    idleMinutes: Math.round(idleMinutes),
    movingMinutes: Math.round(movingMinutes),
    distanceKm: Math.round(distance * 10) / 10,
  };
}
