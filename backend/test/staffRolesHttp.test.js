import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

// Staff roles over HTTP (FLEET_HR_CONTRACT.md section 0): the real routers,
// middleware and controllers, with Prisma's models swapped for an in-memory
// store. Team management (add, change role, switch off) and each role's
// limits as the API enforces them.

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to
delete process.env.HR_INTEGRATION_ENABLED;

const { default: prisma } = await import("../lib/prisma.js");
const { default: authRoutes } = await import("../routes/authRoutes.js");
const { default: userRoutes } = await import("../routes/userRoutes.js");
const { default: vehicleRoutes } = await import("../routes/vehicleRoutes.js");
const { default: alertRoutes } = await import("../routes/alertRoutes.js");

const USERS = [
  { id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a", email: "owner@a.test" },
  { id: "admin-a", role: "ADMIN", companyId: "co-a", adminAccess: "full", email: "admin@a.test" },
  { id: "viewer-a", role: "ADMIN", companyId: "co-a", adminAccess: "viewer", email: "viewer@a.test" },
  { id: "op-a", role: "OPERATOR", companyId: "co-a", email: "op@a.test" },
  { id: "mech-a", role: "MECHANIC", companyId: "co-a", email: "mech@a.test" },
  { id: "acct-a", role: "ACCOUNTANT", companyId: "co-a", email: "acct@a.test" },
  { id: "sup-a", role: "SUPERVISOR", companyId: "co-a", email: "sup@a.test" },
  { id: "driver-a", role: "DRIVER", companyId: "co-a", email: "driver@a.test" },
  { id: "owner-b", role: "COMPANY_OWNER", companyId: "co-b", email: "owner@b.test" },
];

let db;
function reset() {
  db = {
    users: USERS.map((u) => ({ status: "active", createdAt: new Date(), ...u })),
    companies: [{ id: "co-a", name: "A" }, { id: "co-b", name: "B" }],
    vehicles: [{ id: "veh-a", companyId: "co-a", plateNumber: "KAA 001A", status: "idle", driverId: null }],
    alerts: [
      { id: "al-maint", companyId: "co-a", vehicleId: "veh-a", type: "maintenance_due", resolved: false, createdAt: new Date() },
      { id: "al-speed", companyId: "co-a", vehicleId: "veh-a", type: "speeding", resolved: false, createdAt: new Date() },
    ],
    tokens: [{ userId: "driver-a", revoked: false }],
  };
}

const fieldMatches = (value, cond) => {
  if (cond && typeof cond === "object" && !(cond instanceof Date)) {
    if ("in" in cond) return cond.in.includes(value);
    if ("not" in cond) return value !== cond.not;
    return true;
  }
  return value === cond;
};
const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => fieldMatches(row[k], v));
let nextId = 1;
function table(name) {
  return {
    findUnique: async ({ where }) => db[name].find((r) => matches(r, where)) ?? null,
    findFirst: async ({ where }) => db[name].find((r) => matches(r, where)) ?? null,
    findMany: async ({ where } = {}) => db[name].filter((r) => matches(r, where)),
    count: async ({ where }) => db[name].filter((r) => matches(r, where)).length,
    create: async ({ data }) => {
      const row = { id: `${name}-${nextId++}`, createdAt: new Date(), status: "active", ...data };
      db[name].push(row);
      return row;
    },
    update: async ({ where, data }) => Object.assign(db[name].find((r) => matches(r, where)), data),
    updateMany: async ({ where, data }) => {
      const rows = db[name].filter((r) => matches(r, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    },
  };
}

let server;
let baseUrl;
const saved = {};

before(async () => {
  for (const key of ["user", "company", "vehicle", "alert", "refreshToken", "platformSettings", "locationPing"]) saved[key] = prisma[key];
  const users = table("users");
  prisma.user = {
    ...users,
    // the welcome email starts by saving a set-password token: stop there
    async update(args) {
      if (args.data?.resetPasswordTokenHash || args.data?.setPasswordTokenHash) throw new Error("test: no welcome email");
      return users.update(args);
    },
  };
  prisma.company = table("companies");
  prisma.vehicle = table("vehicles");
  prisma.alert = table("alerts");
  prisma.refreshToken = table("tokens");
  prisma.platformSettings = { findFirst: async () => ({ vehicleLimits: {} }) };
  prisma.locationPing = { findFirst: async () => null };

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/vehicles", vehicleRoutes);
  app.use("/api/alerts", alertRoutes);
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

const newMember = (role) => ({ email: `${role.toLowerCase()}@new.test`, password: "long enough pw", fullName: `New ${role}`, role });

test("the owner and full admins add staff roles; others can't", async () => {
  assert.equal((await call("owner-a", "POST", "/api/auth/users", newMember("ACCOUNTANT"))).status, 201);
  assert.equal(db.users.find((u) => u.email === "accountant@new.test").companyId, "co-a");
  assert.equal((await call("admin-a", "POST", "/api/auth/users", newMember("MECHANIC"))).status, 201);
  assert.equal((await call("viewer-a", "POST", "/api/auth/users", newMember("OPERATOR"))).status, 403);
  assert.equal((await call("op-a", "POST", "/api/auth/users", newMember("SUPERVISOR"))).status, 403);
  assert.equal((await call("owner-a", "POST", "/api/auth/users", newMember("COMPANY_OWNER"))).status, 400);
});

test("Team lists the team (not drivers) and changes roles; only owner and full admins", async () => {
  const team = await call("owner-a", "GET", "/api/users/team");
  assert.equal(team.status, 200);
  assert.deepEqual(team.body.map((u) => u.role).sort(), ["ACCOUNTANT", "ADMIN", "ADMIN", "MECHANIC", "OPERATOR", "SUPERVISOR"]);
  assert.ok(!("passwordHash" in team.body[0]));
  assert.equal((await call("viewer-a", "GET", "/api/users/team")).status, 403);
  assert.equal((await call("sup-a", "GET", "/api/users/team")).status, 403);

  const changed = await call("admin-a", "PATCH", "/api/users/team/op-a", { role: "SUPERVISOR" });
  assert.equal(changed.status, 200);
  assert.equal(db.users.find((u) => u.id === "op-a").role, "SUPERVISOR");
  assert.equal((await call("owner-a", "PATCH", "/api/users/team/driver-a", { role: "OPERATOR" })).status, 404, "drivers aren't team members");
  assert.equal((await call("owner-a", "PATCH", "/api/users/team/owner-a", { role: "OPERATOR" })).status, 404, "nor is the owner");
  assert.equal((await call("owner-b", "PATCH", "/api/users/team/mech-a", { role: "OPERATOR" })).status, 404, "nor another company's people");
});

test("a person switched off is signed out at their next request", async () => {
  assert.equal((await call("driver-a", "GET", "/api/users/me")).status, 200);
  const off = await call("owner-a", "PATCH", "/api/users/driver-a/status", { status: "inactive" });
  assert.equal(off.status, 200);
  assert.equal(db.tokens[0].revoked, true);
  const after = await call("driver-a", "GET", "/api/users/me");
  assert.equal(after.status, 401);
  assert.equal(after.body.code, "account_inactive");
  assert.equal((await call("owner-a", "PATCH", "/api/users/driver-a/status", { status: "active" })).status, 200);
  assert.equal((await call("driver-a", "GET", "/api/users/me")).status, 200);
  assert.equal((await call("admin-a", "PATCH", "/api/users/owner-a/status", { status: "inactive" })).status, 404, "never the owner");
  assert.equal((await call("acct-a", "PATCH", "/api/users/driver-a/status", { status: "inactive" })).status, 403);
});

test("each role meets its limits at the API", async () => {
  // everyone on the team reads the fleet
  for (const id of ["op-a", "mech-a", "acct-a", "sup-a"]) assert.equal((await call(id, "GET", "/api/vehicles")).status, 200, id);
  // nobody but owner/full admin changes a vehicle
  for (const id of ["op-a", "mech-a", "acct-a", "sup-a"]) {
    const res = await call(id, "PUT", "/api/vehicles/veh-a", { status: "maintenance" });
    assert.equal(res.status, 403, id);
    assert.equal(res.body.code, "role_forbidden");
  }
  assert.equal(db.vehicles[0].status, "idle");
  // a mechanic closes maintenance alerts, not speeding ones
  assert.equal((await call("mech-a", "PATCH", "/api/alerts/al-speed/resolve")).status, 403);
  assert.equal((await call("mech-a", "PATCH", "/api/alerts/al-maint/resolve")).status, 200);
  // a supervisor and an operator close any alert; an accountant none
  assert.equal((await call("acct-a", "PATCH", "/api/alerts/al-speed/resolve")).status, 403);
  assert.equal((await call("sup-a", "PATCH", "/api/alerts/al-speed/resolve")).status, 200);
  assert.deepEqual(db.alerts.map((a) => a.resolved), [true, true]);
});
