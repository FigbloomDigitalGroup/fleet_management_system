import { distanceKm, MAX_PLAUSIBLE_SPEED_KPH } from "./geo.js";

// Cleans a raw GPS track before it's drawn or measured. The raw pings stay
// in the database untouched; this only decides which ones are trustworthy
// and how they're drawn. Input: pings sorted by recordedAt, each with
// latitude, longitude, recordedAt and (when known) accuracyM, speedKph,
// isMocked.

// Fixes whose reported accuracy radius is worse than this are dropped —
// common in town between tall buildings and right after the GPS wakes up.
export const MAX_TRACK_ACCURACY_M = 50;
// At or below this speed the vehicle is treated as standing still.
const STATIONARY_KPH = 2;
// While standing still, fixes closer than this to the last kept point are
// GPS wobble around a parked vehicle, not movement.
const PARKED_JITTER_M = 20;
// Smoothing restarts after a gap this long (signal lost, tracking off).
const SMOOTHING_GAP_MS = 2 * 60 * 1000;
// Accuracy assumed when the device doesn't report one.
const DEFAULT_ACCURACY_M = 10;

const metresBetween = (a, b) => distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;
const time = (p) => new Date(p.recordedAt).getTime();

// Drops the points that would draw zig-zags, spikes or a "spider web"
// around a parked vehicle: fake GPS, inaccurate fixes, jumps faster than any
// vehicle can drive, and parked wobble.
export function filterTrack(pings) {
  const kept = [];
  for (const p of pings) {
    if (p.isMocked) continue;
    if (p.accuracyM != null && p.accuracyM > MAX_TRACK_ACCURACY_M) continue;
    const last = kept[kept.length - 1];
    if (last) {
      const metres = metresBetween(last, p);
      const hours = (time(p) - time(last)) / 3600000;
      if (hours > 0 && metres / 1000 / hours > MAX_PLAUSIBLE_SPEED_KPH) continue; // a jump, not travel
      const parked = (p.speedKph ?? 0) <= STATIONARY_KPH;
      if (parked && metres < Math.max(PARKED_JITTER_M, p.accuracyM ?? 0)) continue;
    }
    kept.push(p);
  }
  return kept;
}

// A simple Kalman filter on position: each fix is blended with the
// prediction in proportion to how accurate it is, so noisy fixes are pulled
// towards the path while good ones are followed closely. The expected
// movement between fixes scales with the vehicle's speed, so the smoothed
// line doesn't lag behind a fast vehicle.
export function smoothTrack(points) {
  let lat;
  let lng;
  let variance = -1; // m², <0 = not started
  let lastTime;
  return points.map((p) => {
    const accuracy = Math.max(p.accuracyM ?? DEFAULT_ACCURACY_M, 3);
    const t = time(p);
    if (variance < 0 || t - lastTime > SMOOTHING_GAP_MS) {
      lat = p.latitude;
      lng = p.longitude;
      variance = accuracy * accuracy;
    } else {
      const seconds = Math.max(0, (t - lastTime) / 1000);
      const expectedMetresPerSec = Math.max(3, (p.speedKph ?? 0) / 3.6);
      variance += seconds * expectedMetresPerSec * expectedMetresPerSec;
      const gain = variance / (variance + accuracy * accuracy);
      lat += gain * (p.latitude - lat);
      lng += gain * (p.longitude - lng);
      variance *= 1 - gain;
    }
    lastTime = t;
    return { ...p, latitude: lat, longitude: lng };
  });
}

// Both steps: the track to draw and measure.
export function cleanTrack(pings) {
  return smoothTrack(filterTrack(pings));
}
