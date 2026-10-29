import { distanceKm } from "../lib/geo.js";

// Map matching: works out which roads a cleaned GPS track followed, so a
// trip is drawn along the streets instead of cutting through buildings.
// Uses OSRM's /match service — free and open source. OSRM_URL points at the
// server: by default the public demo (fine for testing; it accepts only 10
// points per request and about one request per second), in production a
// self-hosted OSRM with the Kenya road map — raise OSRM_MAX_POINTS there
// (e.g. 100) and the per-request pause goes away.
const DEMO_URL = "https://router.project-osrm.org";
const OSRM_URL = (process.env.OSRM_URL || DEMO_URL).replace(/\/+$/, "");
const IS_DEMO = OSRM_URL === DEMO_URL;
const MAX_POINTS_PER_REQUEST = Number(process.env.OSRM_MAX_POINTS) || (IS_DEMO ? 10 : 100);
const PAUSE_MS = IS_DEMO ? 1100 : 0;
const TIMEOUT_MS = 15000;
// OSRM only needs a fix every so often to tell which roads were taken; the
// rest of the line comes from the road network itself.
const SAMPLE_SPACING_M = IS_DEMO ? 300 : 80;
// How far (m) OSRM may move a fix to reach a road, by the fix's accuracy.
const MIN_RADIUS_M = 15;
const MAX_RADIUS_M = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const metres = (a, b) => distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;

// First and last point plus one roughly every SAMPLE_SPACING_M.
function sample(points) {
  const kept = [points[0]];
  for (const p of points.slice(1, -1)) if (metres(kept[kept.length - 1], p) >= SAMPLE_SPACING_M) kept.push(p);
  kept.push(points[points.length - 1]);
  return kept;
}

async function matchChunk(points) {
  // OSRM wants strictly increasing whole-second timestamps.
  let lastSecond = -Infinity;
  const timestamps = points.map((p) => {
    const s = Math.max(Math.floor(new Date(p.recordedAt).getTime() / 1000), lastSecond + 1);
    lastSecond = s;
    return s;
  });
  const coords = points.map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(";");
  const radiuses = points.map((p) => Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(p.accuracyM ?? 15)))).join(";");
  const url =
    `${OSRM_URL}/match/v1/driving/${coords}` +
    `?geometries=geojson&overview=full&gaps=split&tidy=true&timestamps=${timestamps.join(";")}&radiuses=${radiuses}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code !== "Ok") throw new Error(`OSRM match failed: ${data.code || res.status} ${data.message || ""}`.trim());
  return data.matchings.flatMap((m) => m.geometry.coordinates);
}

// The road-following line for a cleaned track, as [{ lat, lng }]. Throws if
// OSRM can't be used — callers keep the cleaned, unsnapped track.
export async function matchRoadLine(points) {
  if (points.length < 2) throw new Error("Too few points to match");
  const samples = sample(points);
  const line = [];
  // Consecutive requests share one point so the line stays continuous.
  for (let start = 0; start < samples.length - 1; start += MAX_POINTS_PER_REQUEST - 1) {
    if (start > 0 && PAUSE_MS) await sleep(PAUSE_MS);
    for (const [lng, lat] of await matchChunk(samples.slice(start, start + MAX_POINTS_PER_REQUEST))) {
      const last = line[line.length - 1];
      if (!last || last.lat !== lat || last.lng !== lng) line.push({ lat, lng });
    }
  }
  if (line.length < 2) throw new Error("OSRM found no road for this track");
  return line;
}
