import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

// Company owners manage their own fleet like a full fleet admin: they can add
// and change vehicles, drivers and zones, but only inside their own company.
// These run the real routers, middleware and controllers over HTTP, with the
// Prisma client's models swapped for a small in-memory store.

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to

const { default: prisma } = await import("../lib/prisma.js");
const { default: vehicleRoutes } = await import("../routes/vehicleRoutes.js");
const { default: authRoutes } = await import("../routes/authRoutes.js");
const { default: geofenceRoutes } = await import("../routes/geofenceRoutes.js");
const { defaultFleetName } = await import("../controllers/authController.js");

const USERS = [
  { id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a", email: "owner@a.test" },
  { id: "owner-b", role: "COMPANY_OWNER", companyId: "co-b", email: "owner@b.test" },
  { id: "admin-a", role: "ADMIN", companyId: "co-a", adminAccess: "full", email: "admin@a.test" },
  { id: "viewer-a", role: "ADMIN", companyId: "co-a", adminAccess: "viewer", email: "viewer@a.test" },
  { id: "dispatcher-a", role: "ADMIN", companyId: "co-a", adminAccess: "dispatcher", email: "dispatch@a.test" },
  { id: "driver-a", role: "DRIVER", companyId: "co-a", email: "driver@a.test" },
];

let db;
function reset() {
  db = {
    users: USERS.map((u) => ({ ...u })),
    companies: [
      { id: "co-a", name: "Amina's Fleet", subscriptionPlan: "custom" },
      { id: "co-b", name: "Other Fleet", subscriptionPlan: "custom" },
    ],
    vehicles: [{ id: "veh-a", companyId: "co-a", plateNumber: "KAA 001A", status: "idle", driverId: null }],
    geofences: [{ id: "geo-a", companyId: "co-a", name: "Depot", type: "circle" }],
  };
}

const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => row[k] === v);
let nextId = 1;
function table(name) {
  return {
    async findUnique({ where }) {
      return db[name].find((r) => matches(r, where)) ?? null;
    },
    async findFirst({ where }) {
      return db[name].find((r) => matches(r, where)) ?? null;
    },
    async findMany({ where } = {}) {
      return db[name].filter((r) => matches(r, where));
    },
    async count({ where }) {
      return db[name].filter((r) => matches(r, where)).length;
    },
    async create({ data }) {
      const row = { id: `${name}-${nextId++}`, createdAt: new Date(), ...data };
      db[name].push(row);
      return row;
    },
    async update({ where, data }) {
      const row = db[name].find((r) => matches(r, where));
      Object.assign(row, data);
      return row;
    },
    async delete({ where }) {
      db[name] = db[name].filter((r) => !matches(r, where));
    },
  };
}

let server;
let baseUrl;
const saved = {};

before(async () => {
  for (const key of ["user", "company", "vehicle", "geofence", "platformSettings", "locationPing"]) saved[key] = prisma[key];
  prisma.user = {
    ...table("users"),
    // The welcome email starts by saving a set-password token; stop there so
    // no test ever tries to send mail.
    async update() {
      throw new Error("test: no welcome email");
    },
  };
  prisma.company = table("companies");
  prisma.vehicle = table("vehicles");
  prisma.geofence = table("geofences");
  prisma.platformSettings = { findFirst: async () => ({ vehicleLimits: {} }) };
  prisma.locationPing = { findFirst: async () => null };

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/vehicles", vehicleRoutes);
  app.use("/api/geofences", geofenceRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  Object.assign(prisma, saved);
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(reset);

async function call(userId, method, path, body) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// ---- vehicles

test("an owner adds a vehicle, and it always lands in their own company", async () => {
  const res = await call("owner-a", "POST", "/api/vehicles", { plateNumber: "KBB 222B", companyId: "co-b" });
  assert.equal(res.status, 201);
  const created = db.vehicles.find((v) => v.plateNumber === "KBB 222B");
  assert.equal(created.companyId, "co-a", "a companyId in the body is ignored for owners");
});

test("an owner edits and deletes their own vehicles", async () => {
  assert.equal((await call("owner-a", "PUT", "/api/vehicles/veh-a", { status: "maintenance" })).status, 200);
  assert.equal(db.vehicles[0].status, "maintenance");
  assert.equal((await call("owner-a", "DELETE", "/api/vehicles/veh-a")).status, 204);
  assert.equal(db.vehicles.length, 0);
});

test("another company's owner can't see, change or delete the vehicle", async () => {
  assert.equal((await call("owner-b", "GET", "/api/vehicles/veh-a")).status, 404);
  assert.equal((await call("owner-b", "PUT", "/api/vehicles/veh-a", { status: "offline" })).status, 404);
  assert.equal((await call("owner-b", "DELETE", "/api/vehicles/veh-a")).status, 404);
  assert.equal(db.vehicles[0].status, "idle");
  assert.equal(db.vehicles.length, 1);
});

test("restricted admins and drivers still can't add vehicles", async () => {
  for (const userId of ["viewer-a", "dispatcher-a", "driver-a"]) {
    const res = await call(userId, "POST", "/api/vehicles", { plateNumber: `X-${userId}` });
    assert.equal(res.status, 403, userId);
  }
  assert.equal(db.vehicles.length, 1);
  assert.equal((await call("admin-a", "POST", "/api/vehicles", { plateNumber: "KCC 333C" })).status, 201);
});

// ---- drivers

test("an owner adds a driver into their own company", async () => {
  const res = await call("owner-a", "POST", "/api/auth/users", {
    role: "DRIVER",
    fullName: "Juma",
    email: "juma@a.test",
    password: "longenough",
    companyId: "co-b",
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.companyId, "co-a");
  assert.equal(db.users.find((u) => u.email === "juma@a.test").companyId, "co-a");
});

test("drivers and restricted admins can't add drivers", async () => {
  const body = { role: "DRIVER", fullName: "X", email: "x@a.test", password: "longenough" };
  assert.equal((await call("driver-a", "POST", "/api/auth/users", body)).status, 403);
  assert.equal((await call("viewer-a", "POST", "/api/auth/users", body)).status, 403);
  assert.equal(db.users.some((u) => u.email === "x@a.test"), false);
});

test("an owner can assign only their own company's drivers to their vehicles", async () => {
  db.users.push({ id: "driver-b", role: "DRIVER", companyId: "co-b", email: "driver@b.test" });
  assert.equal((await call("owner-a", "PUT", "/api/vehicles/veh-a", { driverId: "driver-b" })).status, 400);
  assert.equal((await call("owner-a", "PUT", "/api/vehicles/veh-a", { driverId: "driver-a" })).status, 200);
  assert.equal(db.vehicles[0].driverId, "driver-a");
});

// ---- geofences

test("an owner draws zones in their own company; another owner can't delete them", async () => {
  const res = await call("owner-a", "POST", "/api/geofences", {
    name: "Yard",
    type: "circle",
    centerLat: -1.28,
    centerLng: 36.82,
    radiusM: 200,
    companyId: "co-b",
  });
  assert.equal(res.status, 201);
  assert.equal(db.geofences.find((g) => g.name === "Yard").companyId, "co-a");

  assert.equal((await call("owner-b", "DELETE", "/api/geofences/geo-a")).status, 404);
  assert.equal(db.geofences.some((g) => g.id === "geo-a"), true);
});

// ---- sign-up without a business name

test("a fleet with no name is called after its owner", () => {
  assert.equal(defaultFleetName("Amina Wanjiru"), "Amina's Fleet");
  assert.equal(defaultFleetName("  Otieno  "), "Otieno's Fleet");
  assert.equal(defaultFleetName(""), "");
  assert.equal(defaultFleetName(undefined), "");
});
