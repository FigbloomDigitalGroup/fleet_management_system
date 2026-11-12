// Seeds "Figbloom Demo Fleet": a company with a week of made-up but
// realistic activity around Nairobi, so a fresh environment has something to
// look at and show prospects.
//   node scripts/seedDemoFleet.js <owner-email> [--reset]
// On the AWS server: docker exec app-app-1 node scripts/seedDemoFleet.js <owner-email> [--reset]
//
// - The company is ACTIVE, on the pro plan (no trial to run out), slug
//   "figbloom-demo-fleet". The owner email becomes its COMPANY_OWNER with a
//   random password nobody ever sees: they set their own with "Forgot
//   password" on the sign-in page, as with createPlatformAdmin.js. An owner
//   who already exists (a second run) keeps their password.
// - One admin and four drivers at @demo.invalid (a domain that can never
//   receive mail), each with a random password: nobody can sign in as them.
// - Six vehicles, a week of GPS pings on Nairobi roads (Mombasa Road, Uhuru
//   Highway, Thika Road, Ngong Road), trips, speeding and harsh braking,
//   two geofences with entry/exit events, alerts, jobs, routes, fuel and
//   other expenses, inspections, maintenance and a few messages.
// - Registered with the Figbloom platform the way the backfill does it
//   (status active, backfill: true; lib/platform/backfill.js), then queued
//   like a normal registration, so it shows in the console as active and the
//   platform's answer can't turn it back to pending.
//
// Running it again changes nothing but the platform registration (and adds
// the owner if a different email is given). --reset deletes everything in
// the demo company except the company row (its id, so the platform record
// stays the same) and the given owner, then seeds it afresh with times up to
// now. Only ever touches the demo company: it refuses a company with that
// slug that it didn't create.
//
// It writes to the database DATABASE_URL points at. Never prints passwords.
import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { filterTrack } from "../lib/gpsFilter.js";
import { distanceKm, sumTripDistanceKm, isInsideGeofence } from "../lib/geo.js";
import { sharedPlatformClient } from "../lib/platform/client.js";
import { registerDecidedCompany } from "../lib/platform/backfill.js";
import { platformDecisionsEnabled } from "../lib/platform/settings.js";
import { TRACKING_CONSENT_VERSION } from "../controllers/trackingController.js";
import { INSPECTION_ITEMS } from "../controllers/inspectionController.js";

export const DEMO_NAME = "Figbloom Demo Fleet";
export const DEMO_SLUG = "figbloom-demo-fleet";
const DEMO_DOMAIN = "demo.invalid";
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NAIROBI_OFFSET = 3 * HOUR; // Africa/Nairobi is UTC+3 all year
const HISTORY_DAYS = 7;
const MOVING_PING_SECONDS = 90;
const STOP_PING_SECONDS = 300;
const FUEL_PRICE_KES = 182; // per litre, roughly Nairobi pump prices
const SPEED_LIMIT_KPH = 80; // the company's default alert limit

// ── Places ──────────────────────────────────────────────────────────────────
// [lat, lng] along real roads, start to finish; `fastFrom` is the index from
// which the road is a highway (speeds 55-85 km/h instead of town traffic).

const DEPOT = [-1.3065, 36.853]; // Enterprise Road, Industrial Area
const CLIENT_SITE = [-1.462, 36.98]; // Athi River EPZ

const ROADS = {
  epz: {
    label: "Mombasa Road",
    fastFrom: 4,
    path: [DEPOT, [-1.314, 36.8545], [-1.32, 36.859], [-1.329, 36.872], [-1.334, 36.882], [-1.345, 36.901], [-1.362, 36.92], [-1.379, 36.934], [-1.392, 36.942], [-1.42, 36.959], [-1.448, 36.974], CLIENT_SITE],
  },
  westlands: {
    label: "Uhuru Highway",
    fastFrom: 99,
    path: [DEPOT, [-1.303, 36.845], [-1.299, 36.838], [-1.297, 36.827], [-1.292, 36.8215], [-1.286, 36.817], [-1.279, 36.815], [-1.273, 36.812], [-1.268, 36.807], [-1.262, 36.803]],
  },
  thika: {
    label: "Thika Road",
    fastFrom: 6,
    path: [DEPOT, [-1.303, 36.845], [-1.299, 36.838], [-1.29, 36.83], [-1.28, 36.833], [-1.27, 36.837], [-1.256, 36.845], [-1.238, 36.87], [-1.219, 36.886], [-1.185, 36.92], [-1.147, 36.96]],
  },
  ngong: {
    label: "Ngong Road",
    fastFrom: 99,
    path: [DEPOT, [-1.303, 36.845], [-1.299, 36.838], [-1.299, 36.825], [-1.3, 36.81], [-1.2995, 36.795], [-1.299, 36.785], [-1.2985, 36.762]],
  },
};

const DEPOT_POLYGON = [
  { lat: -1.3045, lng: 36.851 },
  { lat: -1.3045, lng: 36.8555 },
  { lat: -1.3088, lng: 36.8555 },
  { lat: -1.3088, lng: 36.851 },
];

// ── People and vehicles ─────────────────────────────────────────────────────

const ADMIN = { email: `admin@${DEMO_DOMAIN}`, fullName: "Demo Admin (Dispatch)" };
const DRIVERS = [
  { email: `driver1@${DEMO_DOMAIN}`, fullName: "Demo Driver Juma", phone: "+254700000001" },
  { email: `driver2@${DEMO_DOMAIN}`, fullName: "Demo Driver Achieng", phone: "+254700000002" },
  { email: `driver3@${DEMO_DOMAIN}`, fullName: "Demo Driver Kamau", phone: "+254700000003" },
  { email: `driver4@${DEMO_DOMAIN}`, fullName: "Demo Driver Wanjiru", phone: "+254700000004" },
];

// lastEndMinAgo: when its latest trip ended. speeding: chance of a burst over
// the limit on each highway leg; harsh: chance a sudden hold-up is a harsh stop.
const VEHICLES = [
  { plate: "KDA 482B", make: "Toyota", model: "HiAce", type: "van", status: "active", driver: 0, roads: ["epz", "westlands"], fuelCap: 70, lPer100: 11, odo: 84210, lastEndMinAgo: 4, speeding: 0.1, harsh: 0.1 },
  { plate: "KCX 917M", make: "Isuzu", model: "FRR 500", type: "truck", status: "active", driver: 1, roads: ["epz"], fuelCap: 200, lPer100: 24, odo: 156300, lastEndMinAgo: 9, speeding: 0.5, harsh: 0.15 },
  { plate: "KDG 228L", make: "Toyota", model: "Probox", type: "car", status: "idle", driver: 2, roads: ["westlands", "ngong"], fuelCap: 50, lPer100: 7.5, odo: 61890, lastEndMinAgo: 95, speeding: 0, harsh: 0.35 },
  { plate: "KDJ 641Q", make: "Nissan", model: "NV200", type: "van", status: "active", driver: 3, roads: ["thika", "westlands"], fuelCap: 55, lPer100: 9, odo: 23450, lastEndMinAgo: 2, speeding: 0.25, harsh: 0.1 },
  { plate: "KCU 090H", make: "Mitsubishi", model: "Fuso Canter", type: "truck", status: "maintenance", driver: null, roads: ["epz", "thika"], fuelCap: 100, lPer100: 16, odo: 198700, lastEndMinAgo: 3 * 24 * 60 + 200, speeding: 0.15, harsh: 0.1 },
  { plate: "KBZ 305T", make: "Toyota", model: "Fielder", type: "car", status: "offline", driver: null, roads: ["ngong", "thika"], fuelCap: 45, lPer100: 7, odo: 142050, lastEndMinAgo: 2 * 24 * 60 + 300, speeding: 0.15, harsh: 0.1 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

// The same shape of data on every run (only the times move with "now").
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randomPassword = () => crypto.randomBytes(32).toString("base64url");
const round1 = (n) => Math.round(n * 10) / 10;
const between = (rng, lo, hi) => lo + rng() * (hi - lo);
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
// Hours since Nairobi midnight, and Nairobi's "YYYY-MM-DD".
const nairobiHour = (ms) => (((ms + NAIROBI_OFFSET) % DAY) + DAY) % DAY / HOUR;
const nairobiDateKey = (ms) => new Date(ms + NAIROBI_OFFSET).toISOString().slice(0, 10);
const nairobiAt = (ms, hour) => ms - nairobiHour(ms) * HOUR + hour * HOUR; // same Nairobi day, at `hour`

function bearing([lat1, lng1], [lat2, lng2]) {
  const toRad = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * toRad) * Math.cos(lat2 * toRad);
  const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) - Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lng2 - lng1) * toRad);
  return Math.round(((Math.atan2(y, x) / toRad + 360) % 360) * 10) / 10;
}

// One way along a road: pings every MOVING_PING_SECONDS (offsets in seconds
// from `t0`), with town traffic, highway speeds and the odd hold-up.
function driveLeg(path, fastFrom, reversed, t0, rng, risk, out) {
  const pts = reversed ? [...path].reverse() : path;
  const fastAt = (i) => (reversed ? pts.length - 1 - i >= fastFrom : i >= fastFrom);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distanceKm(...pts[i - 1], ...pts[i]));
  const total = cum[cum.length - 1];

  let pos = 0;
  let t = t0;
  let seg = 0;
  let speedingLeft = 0;
  let prevSpeed = 0;
  let speededThisLeg = rng() >= risk.speeding; // at most one burst a leg
  while (pos < total) {
    while (seg < pts.length - 2 && cum[seg + 1] <= pos) seg++;
    const fast = fastAt(seg) && fastAt(seg + 1);
    let speed;
    let event = null;
    if (speedingLeft > 0) {
      speed = Math.round(between(rng, 92, 108));
      speedingLeft--;
      if (speedingLeft === 0) event = { type: "speeding", value: speed }; // confirmed by the second fix, as the app does
    } else if (rng() < 0.08) {
      speed = Math.round(between(rng, 4, 12)); // a jam
      if (prevSpeed >= 30 && rng() < risk.harsh) event = { type: "harsh_braking", value: round1(between(rng, 12.5, 17)) };
    } else {
      speed = Math.round(fast ? between(rng, 55, 82) : between(rng, 18, 45));
      if (fast && !speededThisLeg && rng() < 0.3) {
        speedingLeft = 2;
        speededThisLeg = true;
      }
    }
    pos = Math.min(total, pos + (speed * MOVING_PING_SECONDS) / 3600);
    t += MOVING_PING_SECONDS;
    while (seg < pts.length - 2 && cum[seg + 1] <= pos) seg++;
    const f = (pos - cum[seg]) / (cum[seg + 1] - cum[seg] || 1);
    const a = pts[seg];
    const b = pts[seg + 1];
    const point = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    out.push({ t, lat: point[0], lng: point[1], speed: pos >= total ? 0 : speed, heading: bearing(a, b), event, road: fast ? "fast" : "town" });
    prevSpeed = speed;
  }
  return t;
}

// Depot -> destination, a stop there, back to the depot.
function simulateTrip(roadKey, rng, risk) {
  const road = ROADS[roadKey];
  const out = [{ t: 0, lat: DEPOT[0], lng: DEPOT[1], speed: 0, heading: 0, event: null }];
  let t = driveLeg(road.path, road.fastFrom, false, 0, rng, risk, out);
  const end = road.path[road.path.length - 1];
  for (let i = 0; i < 3; i++) {
    t += STOP_PING_SECONDS;
    out.push({ t, lat: end[0] + between(rng, -3e-5, 3e-5), lng: end[1] + between(rng, -3e-5, 3e-5), speed: 0, heading: 0, event: null });
  }
  t = driveLeg(road.path, road.fastFrom, true, t, rng, risk, out);
  return { roadKey, label: road.label, pings: out, durationMs: t * 1000 };
}

// Lays a vehicle's trips back in time from its latest one, inside working
// hours (06:30-20:30 Nairobi), 3 to 7 hours apart, over the last week.
function planTrips(v, rng, now) {
  const risk = { speeding: v.speeding, harsh: v.harsh };
  const floor = now - HISTORY_DAYS * DAY;
  const trips = [];
  let cursor = now - v.lastEndMinAgo * MIN; // when the next (earlier) trip must have ended by
  for (let guard = 0; guard < 200; guard++) {
    if (nairobiHour(cursor) > 20.5) cursor = nairobiAt(cursor, 19.5 + rng());
    const sim = simulateTrip(pick(rng, v.roads), rng, risk);
    let start = cursor - sim.durationMs;
    if (nairobiHour(start) < 6.5 || nairobiHour(start) > nairobiHour(cursor)) {
      cursor = nairobiAt(cursor - DAY, 18 + rng() * 2); // the evening before
      continue;
    }
    if (start < floor) break;
    trips.push({ ...sim, start });
    cursor = start - between(rng, 3, 7) * HOUR;
  }
  return trips.reverse();
}

// ── Arguments and safety checks ─────────────────────────────────────────────

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/seedDemoFleet.js <owner-email> [--reset]");
  process.exitCode = 1;
}

async function findDemoCompany() {
  const company = await prisma.company.findUnique({ where: { slug: DEMO_SLUG } });
  if (!company) return null;
  // Ours if it has the demo users, or nothing but owners (a run that stopped early).
  const [demoUsers, others, vehicles] = await Promise.all([
    prisma.user.count({ where: { companyId: company.id, email: { endsWith: `@${DEMO_DOMAIN}` } } }),
    prisma.user.count({ where: { companyId: company.id, role: { not: "COMPANY_OWNER" } } }),
    prisma.vehicle.count({ where: { companyId: company.id } }),
  ]);
  const ours = demoUsers > 0 || (others === 0 && vehicles === 0);
  return { company, ours, seeded: vehicles > 0 };
}

// ── Seeding ─────────────────────────────────────────────────────────────────

async function wipe(tx, companyId, ownerEmail) {
  // Vehicles take their pings, trips, events, alerts, expenses, inspections,
  // maintenance and routes with them; users their messages and tokens.
  await tx.vehicle.deleteMany({ where: { companyId } });
  await tx.job.deleteMany({ where: { companyId } });
  await tx.jobRoute.deleteMany({ where: { companyId } });
  await tx.message.deleteMany({ where: { companyId } });
  await tx.geofenceEvent.deleteMany({ where: { companyId } });
  await tx.geofence.deleteMany({ where: { companyId } });
  await tx.alert.deleteMany({ where: { companyId } });
  await tx.transaction.deleteMany({ where: { companyId } });
  await tx.upload.deleteMany({ where: { companyId } });
  await tx.user.deleteMany({ where: { companyId, email: { not: ownerEmail } } });
}

async function ensureOwner(tx, companyId, email) {
  const existing = await tx.user.findUnique({ where: { email } });
  if (existing) return { user: existing, created: false };
  const user = await tx.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(randomPassword(), 10),
      fullName: "Demo Fleet Owner",
      role: "COMPANY_OWNER",
      companyId,
    },
  });
  return { user, created: true };
}

async function seedData(tx, company, owner, now) {
  const rng = mulberry32(20261112);
  const companyId = company.id;

  // People
  const admin = await tx.user.create({
    data: { email: ADMIN.email, passwordHash: await bcrypt.hash(randomPassword(), 10), fullName: ADMIN.fullName, role: "ADMIN", adminAccess: "full", companyId, phone: "+254700000009" },
  });
  const drivers = [];
  for (const [i, d] of DRIVERS.entries()) {
    drivers.push(
      await tx.user.create({
        data: {
          email: d.email,
          passwordHash: await bcrypt.hash(randomPassword(), 10),
          fullName: d.fullName,
          role: "DRIVER",
          companyId,
          phone: d.phone,
          licenseNumber: `DEMO-DL-000${i + 1}`,
          licenseExpiry: `${new Date(now).getUTCFullYear() + 2}-06-30`,
          consentAcceptedAt: new Date(now - 30 * DAY),
          consentVersion: TRACKING_CONSENT_VERSION,
        },
      })
    );
  }

  // Geofences
  const depot = await tx.geofence.create({ data: { companyId, name: "Depot - Industrial Area", type: "polygon", polygon: DEPOT_POLYGON } });
  const site = await tx.geofence.create({
    data: { companyId, name: "Client site - Athi River EPZ warehouse", type: "circle", centerLat: CLIENT_SITE[0], centerLng: CLIENT_SITE[1], radiusM: 500 },
  });
  const geofences = [depot, site];
  await tx.company.update({
    where: { id: companyId },
    data: { dailyStartPoint: { lat: DEPOT[0], lng: DEPOT[1], geofenceId: depot.id, updatedAt: new Date(now).toISOString() } },
  });

  const alerts = [];
  const vehicles = [];
  const speedingEvents = [];
  const harshEvents = [];
  const inspectionsFor = [];
  const clientSiteEntries = [];

  for (const spec of VEHICLES) {
    const driver = spec.driver == null ? null : drivers[spec.driver];
    const trips = planTrips(spec, rng, now);
    const lastPingAt = trips.length ? trips[trips.length - 1].start + trips[trips.length - 1].durationMs : now - spec.lastEndMinAgo * MIN;
    const vehicle = await tx.vehicle.create({
      data: {
        companyId,
        plateNumber: spec.plate,
        make: spec.make,
        model: spec.model,
        vehicleType: spec.type,
        status: spec.status,
        statusManuallySet: true, // keeps the mix of statuses; the offline sweep won't flip them
        driverId: driver?.id ?? null,
        startGeofenceId: depot.id,
        fuelCapacityLiters: spec.fuelCap,
        avgConsumptionLPer100Km: spec.lPer100,
        odometerBaseKm: spec.odo,
        // a driver's phone; offlineAlertedAt so the offline sweep doesn't
        // raise a "no signal" alert as this snapshot ages
        device: driver
          ? {
              lastSeenAt: new Date(lastPingAt).toISOString(),
              batteryLevel: Math.round(between(rng, 35, 95)),
              isCharging: spec.status === "active",
              locationEnabled: true,
              permission: "always",
              appState: "background",
              isSharing: true,
              platform: "android",
              appVersion: "1.0.0",
              offlineAlertedAt: new Date(now).toISOString(),
            }
          : null,
      },
    });
    vehicles.push({ spec, vehicle, driver, trips });

    // Pings, trips, fuel and the driving events on them, oldest first.
    let fuel = spec.fuelCap * 0.32;
    const allPings = [];
    let firstOfDay = null;
    for (const trip of trips) {
      if (fuel < spec.fuelCap * 0.35) {
        const liters = round1(spec.fuelCap * 0.95 - fuel);
        await tx.expense.create({
          data: { companyId, vehicleId: vehicle.id, driverId: driver?.id ?? null, category: "fuel", amount: Math.round(liters * FUEL_PRICE_KES), note: `${liters} L at the depot pump`, incurredAt: new Date(trip.start - 15 * MIN) },
        });
        fuel = spec.fuelCap * 0.95;
      }
      const rows = [];
      let prev = null;
      for (const p of trip.pings) {
        if (prev) fuel -= (distanceKm(prev.lat, prev.lng, p.lat, p.lng) * spec.lPer100) / 100;
        prev = p;
        const recordedAt = new Date(trip.start + p.t * 1000);
        rows.push({
          vehicleId: vehicle.id,
          latitude: Math.round(p.lat * 1e6) / 1e6,
          longitude: Math.round(p.lng * 1e6) / 1e6,
          speedKph: p.speed,
          heading: p.heading,
          fuelLevelLiters: round1(Math.max(fuel, 0)),
          accuracyM: Math.round(between(rng, 4, 14)),
          source: "driver_app",
          recordedAt,
        });
        if (p.event) {
          const ev = { companyId, vehicleId: vehicle.id, driverId: driver?.id ?? null, type: p.event.type, source: p.event.type === "speeding" ? "gps" : "sensor", value: p.event.value, speedKph: p.speed, latitude: p.lat, longitude: p.lng, recordedAt };
          (p.event.type === "speeding" ? speedingEvents : harshEvents).push({ ...ev, plate: spec.plate, road: trip.label });
        }
      }
      await tx.locationPing.createMany({ data: rows });
      allPings.push(...rows);
      const first = rows[0];
      const last = rows[rows.length - 1];
      await tx.trip.create({
        data: {
          vehicleId: vehicle.id,
          driverId: driver?.id ?? null,
          startTime: first.recordedAt,
          endTime: last.recordedAt,
          startLat: first.latitude,
          startLng: first.longitude,
          endLat: last.latitude,
          endLng: last.longitude,
          distanceKm: round1(sumTripDistanceKm(filterTrack(rows))),
          purpose: "business",
          note: `Depot to ${trip.label} and back`,
          endedBy: "auto",
        },
      });

      // A pre-trip inspection before each driver's first trip of the day.
      const day = nairobiDateKey(trip.start);
      if (driver && day !== firstOfDay) {
        firstOfDay = day;
        inspectionsFor.push({ vehicle, driver, at: trip.start - 20 * MIN, odometerKm: spec.odo });
      }
    }

    // Geofence crossings over the whole week of pings.
    const inside = new Map(geofences.map((g) => [g.id, allPings.length ? isInsideGeofence(allPings[0].latitude, allPings[0].longitude, g) : true]));
    const crossings = [];
    for (const p of allPings) {
      for (const g of geofences) {
        const now_ = isInsideGeofence(p.latitude, p.longitude, g);
        if (now_ === inside.get(g.id)) continue;
        inside.set(g.id, now_);
        crossings.push({ companyId, vehicleId: vehicle.id, driverId: driver?.id ?? null, geofenceId: g.id, geofenceName: g.name, kind: now_ ? "enter" : "exit", latitude: p.latitude, longitude: p.longitude, recordedAt: p.recordedAt });
        if (now_ && g.id === site.id) clientSiteEntries.push({ vehicle, at: p.recordedAt });
      }
    }
    if (crossings.length) await tx.geofenceEvent.createMany({ data: crossings });
  }

  const events = [...speedingEvents, ...harshEvents].map(({ plate, road, ...ev }) => ev);
  if (events.length) await tx.drivingEvent.createMany({ data: events });

  // Inspections: all pass but the latest one for KDJ 641Q (worn tyre).
  const lastFailed = inspectionsFor.filter((i) => i.vehicle.plateNumber === "KDJ 641Q").at(-1);
  for (const i of inspectionsFor) {
    const failed = i === lastFailed;
    const items = INSPECTION_ITEMS.map((it) => ({ key: it.key, label: it.label, ok: !(failed && it.key === "tyres"), note: failed && it.key === "tyres" ? "Rear left tyre tread worn close to the limit" : "", photoUploadId: null }));
    await tx.inspection.create({
      data: { companyId, vehicleId: i.vehicle.id, driverId: i.driver.id, items, passed: !failed, odometerKm: i.odometerKm, notes: failed ? "Tyre needs replacing this week" : null, latitude: DEPOT[0], longitude: DEPOT[1], createdAt: new Date(i.at) },
    });
    if (failed) alerts.push({ vehicleId: i.vehicle.id, type: "inspection_failed", message: `Pre-trip inspection failed for ${i.vehicle.plateNumber}: Tyres (pressure, tread, damage) - Rear left tyre tread worn close to the limit.`, at: i.at + MIN, resolved: false });
  }

  // Alerts: the latest speeding and harsh braking open, older ones resolved.
  const latest = (list) => [...list].sort((a, b) => b.recordedAt - a.recordedAt);
  for (const [n, e] of latest(speedingEvents).slice(0, 3).entries()) {
    alerts.push({ vehicleId: e.vehicleId, type: "speeding", message: `Vehicle recorded at ${e.value} km/h, exceeding the ${SPEED_LIMIT_KPH} km/h limit (${e.road}).`, at: +e.recordedAt, resolved: n > 0 });
  }
  for (const [n, e] of latest(harshEvents).slice(0, 2).entries()) {
    alerts.push({ vehicleId: e.vehicleId, type: "harsh_braking", message: `Harsh braking detected on ${e.road}: about ${e.value} km/h lost per second.`, at: +e.recordedAt, resolved: n > 0 });
  }
  const lastSiteEntry = clientSiteEntries.sort((a, b) => b.at - a.at)[0];
  if (lastSiteEntry) alerts.push({ vehicleId: lastSiteEntry.vehicle.id, type: "geofence_entry", message: `Vehicle entered geofence "${site.name}".`, at: +lastSiteEntry.at, resolved: true });
  const offline = vehicles.find((v) => v.spec.status === "offline");
  if (offline) alerts.push({ vehicleId: offline.vehicle.id, type: "device_offline", message: `No signal from ${offline.spec.plate} since ${new Date(now - offline.spec.lastEndMinAgo * MIN).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" })} - the tracker may be unplugged.`, at: now - offline.spec.lastEndMinAgo * MIN + 20 * MIN, resolved: false });

  // Maintenance: a service done, one overdue (the truck in the workshop), one due soon, one later.
  const truck = vehicles.find((v) => v.spec.status === "maintenance");
  const byPlate = (plate) => vehicles.find((v) => v.spec.plate === plate).vehicle;
  const maintenance = [
    { vehicleId: truck.vehicle.id, kind: "record", title: "Brake pads and discs replaced", notes: "Front axle. Demo record.", performedAt: new Date(now - 1 * DAY), odometerKm: truck.spec.odo, costKes: 18500, status: "done" },
    { vehicleId: byPlate("KDA 482B").id, kind: "record", title: "Full service (oil, filters, plugs)", performedAt: new Date(now - 26 * DAY), odometerKm: 81900, costKes: 12800, status: "done" },
    { vehicleId: truck.vehicle.id, kind: "reminder", title: "20,000 km service", dueDate: new Date(now - 2 * DAY), intervalDays: 180, status: "open", alertedAt: new Date(now - 2 * DAY) },
    { vehicleId: byPlate("KDA 482B").id, kind: "reminder", title: "Insurance renewal", dueDate: new Date(now + 5 * DAY), intervalDays: 365, status: "open" },
    { vehicleId: byPlate("KCX 917M").id, kind: "reminder", title: "Oil and filter change", dueOdometerKm: 160000, intervalKm: 10000, status: "open" },
  ];
  for (const m of maintenance) await tx.maintenanceRecord.create({ data: { companyId, ...m } });
  alerts.push({ vehicleId: truck.vehicle.id, type: "maintenance_due", message: `20,000 km service for ${truck.spec.plate} was due on ${new Date(now - 2 * DAY).toLocaleDateString("en-GB")}.`, at: now - 2 * DAY, resolved: false });
  await tx.expense.create({ data: { companyId, vehicleId: truck.vehicle.id, category: "repair", amount: 18500, note: "Brake pads and discs (workshop invoice, demo)", incurredAt: new Date(now - 1 * DAY) } });

  // A few non-fuel expenses.
  const extras = [
    { plate: "KDA 482B", category: "toll", amount: 360, note: "Nairobi Expressway, JKIA to Westlands", ago: 2 * DAY + 3 * HOUR },
    { plate: "KDG 228L", category: "parking", amount: 300, note: "CBD street parking", ago: 1 * DAY + 5 * HOUR },
    { plate: "KDJ 641Q", category: "other", amount: 1500, note: "Car wash and interior clean", ago: 4 * DAY },
  ];
  for (const e of extras) {
    const v = vehicles.find((x) => x.spec.plate === e.plate);
    await tx.expense.create({ data: { companyId, vehicleId: v.vehicle.id, driverId: v.driver?.id ?? null, category: e.category, amount: e.amount, note: e.note, incurredAt: new Date(now - e.ago) } });
  }

  for (const a of alerts) {
    await tx.alert.create({
      data: { companyId, vehicleId: a.vehicleId, type: a.type, message: a.message, resolved: a.resolved, resolvedAt: a.resolved ? new Date(now) : null, createdAt: new Date(a.at) },
    });
  }

  // Jobs: today's run for Juma (done, at the stop, still to go), yesterday's
  // for Achieng (on time, late, failed), tomorrow's for Wanjiru.
  const today = nairobiDateKey(now);
  const yesterday = nairobiDateKey(now - DAY);
  const tomorrow = nairobiDateKey(now + DAY);
  const v = (i) => vehicles[i];
  const stops = {
    gateway: { address: "Gateway Mall, Mombasa Road, Syokimau", lat: -1.362, lng: 36.92 },
    syokimau: { address: "Syokimau SGR station, Nairobi", lat: -1.3795, lng: 36.9345 },
    epz: { address: "Athi River EPZ, Warehouse 7", lat: CLIENT_SITE[0], lng: CLIENT_SITE[1] },
    sarit: { address: "Sarit Centre, Westlands", lat: -1.2612, lng: 36.8025 },
    yaya: { address: "Yaya Centre, Argwings Kodhek Road", lat: -1.2931, lng: 36.7878 },
    garden: { address: "Garden City Mall, Thika Road", lat: -1.2322, lng: 36.8783 },
    ruiru: { address: "Ruiru town, Thika Road", lat: -1.147, lng: 36.96 },
  };
  const jobSpecs = [
    { who: 0, date: today, stop: "gateway", title: "Deliver 12 cartons (demo order 1041)", status: "completed", seq: 1, window: [-4, -2], done: -150 },
    { who: 0, date: today, stop: "syokimau", title: "Collect returns (demo order 1042)", status: "arrived", seq: 2, window: [-1, 1], arrived: -10 },
    { who: 0, date: today, stop: "epz", title: "Deliver pallets to EPZ warehouse (demo order 1043)", status: "assigned", seq: 3, window: [1, 3] },
    { who: 1, date: yesterday, stop: "epz", title: "Deliver 4 pallets (demo order 1031)", status: "completed", seq: 1, window: [-30, -28], done: -29 * 60 },
    { who: 1, date: yesterday, stop: "gateway", title: "Deliver shop stock (demo order 1032)", status: "completed", seq: 2, window: [-27, -26], done: -25 * 60 },
    { who: 1, date: yesterday, stop: "syokimau", title: "Deliver parcel (demo order 1033)", status: "failed", seq: 3, window: [-25, -24], failed: -24.5 * 60, reason: "Customer not available, rescheduled" },
    { who: 3, date: tomorrow, stop: "garden", title: "Deliver display units (demo order 1051)", status: "assigned", seq: 1, window: [20, 22] },
    { who: 3, date: tomorrow, stop: "ruiru", title: "Collect empty crates (demo order 1052)", status: "assigned", seq: 2, window: [23, 25] },
    { who: 2, date: today, stop: "sarit", title: "Drop documents at client office (demo)", status: "completed", seq: 1, window: [-3, -1], done: -100 },
  ];
  const jobsByDriverDay = new Map();
  for (const j of jobSpecs) {
    const s = stops[j.stop];
    const at = (min) => (min == null ? null : new Date(now + min * MIN));
    const job = await tx.job.create({
      data: {
        companyId,
        driverId: v(j.who).driver.id,
        vehicleId: v(j.who).vehicle.id,
        title: j.title,
        address: s.address,
        latitude: s.lat,
        longitude: s.lng,
        contactName: "Demo Contact",
        contactPhone: "+254700000100",
        scheduledDate: j.date,
        windowStart: new Date(now + j.window[0] * HOUR),
        windowEnd: new Date(now + j.window[1] * HOUR),
        sequence: j.seq,
        status: j.status,
        failureReason: j.reason ?? null,
        startedAt: j.done != null ? at(j.done - 40) : j.arrived != null ? at(j.arrived - 30) : j.failed != null ? at(j.failed - 30) : null,
        arrivedAt: j.done != null ? at(j.done - 8) : j.arrived != null ? at(j.arrived) : j.failed != null ? at(j.failed - 5) : null,
        completedAt: at(j.done),
        failedAt: at(j.failed),
        proof: j.status === "completed" ? { photoUploadIds: [], signatureUploadId: null, recipientName: "Demo Receiver", notes: "Received in good condition", scannedCode: null, latitude: s.lat, longitude: s.lng, capturedAt: at(j.done).toISOString() } : null,
        trackingToken: crypto.randomBytes(18).toString("hex"),
        createdById: admin.id,
        createdAt: new Date(now - 2 * DAY),
      },
    });
    const key = `${job.driverId}|${j.date}`;
    jobsByDriverDay.set(key, [...(jobsByDriverDay.get(key) ?? []), { job, s }]);
  }
  // The optimized line through each driver's day (straight lines: no road data in a seed).
  for (const list of jobsByDriverDay.values()) {
    const path = [{ lat: DEPOT[0], lng: DEPOT[1] }, ...list.map((x) => ({ lat: x.s.lat, lng: x.s.lng }))];
    let km = 0;
    for (let i = 1; i < path.length; i++) km += distanceKm(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
    await tx.jobRoute.create({
      data: { companyId, driverId: list[0].job.driverId, scheduledDate: list[0].job.scheduledDate, path, jobIds: list.map((x) => x.job.id), startLat: DEPOT[0], startLng: DEPOT[1], distanceKm: round1(km), durationMin: Math.round((km / 30) * 60), source: "straight" },
    });
  }

  // Recurring routes, and the days they were driven.
  const routeSpecs = [
    { i: 1, name: "Daily EPZ run (Mombasa Road)", road: "epz", days: [1, 2, 3, 4, 5, 6] },
    { i: 2, name: "Westlands client shuttle", road: "westlands", days: [1, 3, 5] },
  ];
  for (const r of routeSpecs) {
    const { vehicle, driver, trips } = vehicles[r.i];
    const route = await tx.route.create({
      data: { companyId, vehicleId: vehicle.id, name: r.name, waypoints: ROADS[r.road].path.map(([lat, lng]) => ({ lat, lng })), toleranceMeters: 300, speedLimitKph: SPEED_LIMIT_KPH, frequency: "weekly", daysOfWeek: r.days },
    });
    const done = new Set();
    for (const t of trips) {
      const key = nairobiDateKey(t.start);
      if (t.roadKey !== r.road || done.has(key)) continue;
      done.add(key);
      await tx.routeCompletion.create({ data: { companyId, routeId: route.id, vehicleId: vehicle.id, driverId: driver?.id ?? null, dateKey: key, completedAt: new Date(t.start + t.durationMs) } });
    }
  }

  // A couple of message threads.
  const messages = [
    { driver: 0, from: admin, body: "Morning Juma, the EPZ pallets are ready at bay 3.", ago: 5 * HOUR, read: true },
    { driver: 0, from: drivers[0], body: "Loaded, leaving the depot now.", ago: 4.8 * HOUR, read: true },
    { driver: 2, from: drivers[2], body: "Heavy traffic on Waiyaki Way, about 15 minutes late to Sarit.", ago: 3 * HOUR, read: false },
    { driver: 1, from: owner, body: "Please keep it under 80 on Mombasa Road. Thanks.", ago: 20 * HOUR, read: true },
  ];
  for (const m of messages) {
    const fromDriver = m.from.id === drivers[m.driver].id;
    await tx.message.create({ data: { companyId, driverId: drivers[m.driver].id, senderId: m.from.id, fromDriver, body: m.body, readAt: m.read ? new Date(now - m.ago + 10 * MIN) : null, createdAt: new Date(now - m.ago) } });
  }

}

// ── Figbloom platform ───────────────────────────────────────────────────────

// Registered the backfill way, so the console shows it active
// (lib/platform/backfill.js registerDecidedCompany).
function registerWithPlatform(companyId) {
  return registerDecidedCompany(prisma, sharedPlatformClient(), companyId, {
    decisionsOn: platformDecisionsEnabled(),
    source: "seed (console decision)",
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const unknown = args.filter((a) => a.startsWith("--") && a !== "--reset");
  const positional = args.filter((a) => !a.startsWith("--"));
  const ownerEmail = positional[0]?.trim().toLowerCase();
  if (unknown.length) return usage(`Unknown option ${unknown.join(", ")}.`);
  if (positional.length !== 1 || !ownerEmail || !EMAIL.test(ownerEmail)) return usage("Give the owner's email address.");
  if (ownerEmail.endsWith(`@${DEMO_DOMAIN}`)) return usage(`The owner must be a real address, not @${DEMO_DOMAIN}.`);

  const found = await findDemoCompany();
  if (found && !found.ours) {
    return usage(`A company with the slug "${DEMO_SLUG}" exists (${found.company.id}, "${found.company.name}") that this script did not create. Nothing changed.`);
  }

  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { companyId: true, role: true } });
  if (existingOwner && (existingOwner.companyId !== found?.company.id || existingOwner.role !== "COMPANY_OWNER")) {
    return usage(`${ownerEmail} already has an account elsewhere (${existingOwner.role}). Use another address (for example a +demo alias). Nothing changed.`);
  }

  const now = Date.now();
  let companyId = found?.company.id;
  let action;
  let ownerCreated = false;

  if (found?.seeded && !reset) {
    action = "already seeded (nothing changed; --reset to seed again)";
    const r = await prisma.$transaction((tx) => ensureOwner(tx, companyId, ownerEmail));
    ownerCreated = r.created;
  } else {
    action = found ? (reset ? "reset and seeded again" : "seeded") : "created and seeded";
    await prisma.$transaction(
      async (tx) => {
        let company;
        if (found) {
          await wipe(tx, found.company.id, ownerEmail);
          company = await tx.company.update({
            where: { id: found.company.id },
            data: { name: DEMO_NAME, status: "active", subscriptionPlan: "pro", trialEndsAt: null, industry: "logistics_courier" },
          });
        } else {
          company = await tx.company.create({
            data: { name: DEMO_NAME, slug: DEMO_SLUG, status: "active", subscriptionPlan: "pro", trialEndsAt: null, industry: "logistics_courier" },
          });
        }
        companyId = company.id;
        const { user: owner, created } = await ensureOwner(tx, company.id, ownerEmail);
        ownerCreated = created;
        await seedData(tx, company, owner, now);
      },
      { timeout: 180_000, maxWait: 20_000 }
    );
  }

  const platform = await registerWithPlatform(companyId);

  // Summary (read back from the database, so a re-run reports what's there).
  const where = { companyId };
  const vehicleIds = (await prisma.vehicle.findMany({ where, select: { id: true } })).map((x) => x.id);
  const [company, admins, drivers, pings, trips, drivingEvents, geofences, geofenceEvents, openAlerts, alerts, jobs, routes, expenses, inspections, maintenance, messages] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, slug: true, status: true, subscriptionPlan: true } }),
    prisma.user.count({ where: { ...where, role: "ADMIN" } }),
    prisma.user.count({ where: { ...where, role: "DRIVER" } }),
    prisma.locationPing.count({ where: { vehicleId: { in: vehicleIds } } }),
    prisma.trip.count({ where: { vehicleId: { in: vehicleIds } } }),
    prisma.drivingEvent.count({ where }),
    prisma.geofence.count({ where }),
    prisma.geofenceEvent.count({ where }),
    prisma.alert.count({ where: { ...where, resolved: false } }),
    prisma.alert.count({ where }),
    prisma.job.count({ where }),
    prisma.route.count({ where }),
    prisma.expense.count({ where }),
    prisma.inspection.count({ where }),
    prisma.maintenanceRecord.count({ where }),
    prisma.message.count({ where }),
  ]);

  console.log(`${company.name}: ${action}`);
  console.log(`  company id   ${company.id} (slug ${company.slug}, status ${company.status}, plan ${company.subscriptionPlan})`);
  console.log(`  owner        ${ownerEmail}${ownerCreated ? ' (new: set a password with "Forgot password" on the sign-in page)' : " (existing account, password unchanged)"}`);
  console.log(`  users        ${admins} admin, ${drivers} drivers (@${DEMO_DOMAIN}, random passwords: nobody can sign in as them)`);
  console.log(`  vehicles     ${vehicleIds.length}; ${pings} GPS pings, ${trips} trips, ${drivingEvents} driving events`);
  console.log(`  geofences    ${geofences}, ${geofenceEvents} entry/exit events`);
  console.log(`  alerts       ${alerts} (${openAlerts} open; resolved ones are cleared 30 minutes after resolving, as for any company)`);
  console.log(`  dispatch     ${jobs} jobs, ${routes} routes`);
  console.log(`  records      ${expenses} expenses, ${inspections} inspections, ${maintenance} maintenance items, ${messages} messages`);
  if (!platform.configured) {
    console.log(`  platform     PLATFORM_* not set: ${platform.queued ? "queued; it is sent once they are" : "not queued (decisions are on); run this again once PLATFORM_* is set"}`);
  } else if (platform.result === "error") {
    console.log(`  platform     not registered: ${platform.error.replace(/\.$/, "")}. ${platform.queued ? "Queued; the every-minute sync retries." : "Not queued (decisions are on, so it would arrive pending); run this again."}`);
    process.exitCode = 1;
  } else {
    console.log(`  platform     ${platform.result} (platform status ${platform.platformStatus ?? "unknown"})${platform.adopted ? `; the console's decision (${platform.adopted}) applied here` : ""}; queued`);
  }
}

run()
  .catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
