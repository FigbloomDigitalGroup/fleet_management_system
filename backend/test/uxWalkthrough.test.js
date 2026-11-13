import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Fixes from the real-browser UX walkthrough that live in the API:
// - a pending/suspended company's sign-in says why, with what the web page
//   needs for a status screen (code, approval mode, support address);
// - registration says how the company gets switched on;
// - resolved alerts are kept as history (at least 90 days), and the list
//   returns every open alert plus recent history;
// - a vehicle says whether a tracker token exists, never the token itself.
// Real routers and controllers over HTTP, Prisma models swapped for an
// in-memory store.

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to

const { default: prisma } = await import("../lib/prisma.js");
const { default: authRoutes } = await import("../routes/authRoutes.js");
const { default: alertRoutes } = await import("../routes/alertRoutes.js");
const { default: vehicleRoutes } = await import("../routes/vehicleRoutes.js");
const { approvalMode } = await import("../controllers/authController.js");
const { installMembershipModels, migrateLegacyUsers } = await import("./helpers/memoryModel.js");
const { purgeExpiredRecords, resolvedAlertRetentionDays, RESOLVED_ALERT_MIN_RETENTION_DAYS } = await import("../lib/cleanup.js");

const DAY = 86400000;
const PASSWORD = "correct horse";
let hash;
let db;

function reset() {
  const now = Date.now();
  const legacy = [
      { id: "owner-p", role: "COMPANY_OWNER", companyId: "co-pending", email: "owner@pending.test", status: "active", fullName: "Wanjiru" },
      { id: "owner-s", role: "COMPANY_OWNER", companyId: "co-suspended", email: "owner@suspended.test", status: "active", fullName: "Otieno" },
      { id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a", email: "owner@a.test", status: "active", fullName: "Amina" },
    ].map((u) => ({ ...u, passwordHash: hash }));
  db = {
    // as the memberships migration leaves them
    ...migrateLegacyUsers(legacy),
    companies: [
      { id: "co-pending", name: "Kilimo Haulage", status: "pending", subscriptionPlan: "trial", createdAt: new Date(now - 3600000), dataRetentionDays: 180 },
      { id: "co-suspended", name: "Paused Fleet", status: "suspended", subscriptionPlan: "basic", createdAt: new Date(now - 30 * DAY), dataRetentionDays: 180 },
      { id: "co-a", name: "Amina's Fleet", status: "active", subscriptionPlan: "pro", createdAt: new Date(now - 60 * DAY), dataRetentionDays: 365 },
      { id: "co-b", name: "Short Retention", status: "active", subscriptionPlan: "pro", createdAt: new Date(now - 60 * DAY), dataRetentionDays: 30 },
    ],
    platformSettings: [{ id: "ps", requireManualApproval: true, supportEmail: "support@figbloom.org", vehicleLimits: {}, createdAt: new Date(0) }],
    vehicles: [
      { id: "veh-token", companyId: "co-a", plateNumber: "KAA 001A", trackerToken: "secret-token-value" },
      { id: "veh-none", companyId: "co-a", plateNumber: "KAA 002B", trackerToken: null },
    ],
    alerts: [
      { id: "open-old", companyId: "co-a", type: "speeding", resolved: false, resolvedAt: null, createdAt: new Date(now - 200 * DAY) },
      { id: "resolved-recent", companyId: "co-a", type: "speeding", resolved: true, resolvedAt: new Date(now - 2 * DAY), createdAt: new Date(now - 2 * DAY) },
      { id: "resolved-40d", companyId: "co-a", type: "geofence_exit", resolved: true, resolvedAt: new Date(now - 40 * DAY), createdAt: new Date(now - 40 * DAY) },
      { id: "resolved-120d", companyId: "co-a", type: "sos", resolved: true, resolvedAt: new Date(now - 120 * DAY), createdAt: new Date(now - 120 * DAY) },
      { id: "resolved-400d", companyId: "co-a", type: "sos", resolved: true, resolvedAt: new Date(now - 400 * DAY), createdAt: new Date(now - 400 * DAY) },
      { id: "b-resolved-60d", companyId: "co-b", type: "sos", resolved: true, resolvedAt: new Date(now - 60 * DAY), createdAt: new Date(now - 60 * DAY) },
      { id: "b-resolved-100d", companyId: "co-b", type: "sos", resolved: true, resolvedAt: new Date(now - 100 * DAY), createdAt: new Date(now - 100 * DAY) },
      { id: "message", companyId: "co-a", type: "admin_message", resolved: false, resolvedAt: null, createdAt: new Date(now) },
    ],
    refreshTokens: [],
  };
}

// Just enough of Prisma's where-clause language for these controllers.
function fieldMatches(value, cond) {
  if (cond && typeof cond === "object" && !(cond instanceof Date)) {
    if ("not" in cond && value === cond.not) return false;
    if ("gte" in cond && !(value >= cond.gte)) return false;
    if ("lt" in cond && !(value < cond.lt)) return false;
    if ("in" in cond && !cond.in.includes(value)) return false;
    return true;
  }
  return value === cond;
}
const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => fieldMatches(row[k], v));

let nextId = 1;
function table(name) {
  return {
    async findUnique({ where }) {
      return db[name].find((r) => matches(r, where)) ?? null;
    },
    async findFirst({ where = {} } = {}) {
      return db[name].find((r) => matches(r, where)) ?? null;
    },
    async findMany({ where = {}, take } = {}) {
      const rows = db[name].filter((r) => matches(r, where));
      return take ? rows.slice(0, take) : rows;
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
    async deleteMany({ where = {} } = {}) {
      const before = db[name].length;
      db[name] = db[name].filter((r) => !matches(r, where));
      return { count: before - db[name].length };
    },
  };
}

let server;
let baseUrl;
const saved = {};
const MODELS = { user: "users", company: "companies", platformSettings: "platformSettings", vehicle: "vehicles", alert: "alerts", refreshToken: "refreshTokens" };

before(async () => {
  hash = await bcrypt.hash(PASSWORD, 4);
  for (const [model, name] of Object.entries(MODELS)) {
    saved[model] = prisma[model];
    prisma[model] = table(name);
  }
  installMembershipModels(prisma, saved, () => db);
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/vehicles", vehicleRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const [model, value] of Object.entries(saved)) prisma[model] = value;
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => reset());

const tokenFor = (id) => {
  const u = db.users.find((x) => x.id === id);
  return jwt.sign({ id: u.id, role: u.role, companyId: u.companyId }, process.env.JWT_SECRET, { expiresIn: "5m" });
};

async function call(method, path, { body, as } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(as ? { Authorization: `Bearer ${tokenFor(as)}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("approvalMode: the Figbloom console decides when decisions are on, else the platform setting", () => {
  assert.equal(approvalMode({ requireManualApproval: true }, { PLATFORM_DECISIONS_ENABLED: "true" }), "console");
  assert.equal(approvalMode({ requireManualApproval: false }, { PLATFORM_DECISIONS_ENABLED: "1" }), "console");
  assert.equal(approvalMode({ requireManualApproval: true }, {}), "manual");
  assert.equal(approvalMode({ requireManualApproval: false }, {}), "auto");
});

test("signing in to a pending company explains itself for a status page", async () => {
  const r = await call("POST", "/api/auth/login", { body: { email: "owner@pending.test", password: PASSWORD, platform: "web" } });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "company_pending");
  assert.equal(r.body.companyName, "Kilimo Haulage");
  assert.equal(r.body.approval, "manual");
  assert.equal(r.body.supportEmail, "support@figbloom.org");
  assert.match(r.body.error, /awaiting approval/); // the driver app still reads `error`
  assert.ok(!("accessToken" in r.body));
});

test("a suspended company's sign-in has its own code; a wrong password still says nothing about the company", async () => {
  const s = await call("POST", "/api/auth/login", { body: { email: "owner@suspended.test", password: PASSWORD, platform: "web" } });
  assert.equal(s.status, 403);
  assert.equal(s.body.code, "company_suspended");
  const w = await call("POST", "/api/auth/login", { body: { email: "owner@pending.test", password: "wrong-password", platform: "web" } });
  assert.equal(w.status, 401);
  assert.equal(w.body.code, undefined);
  assert.equal(w.body.companyName, undefined);
});

test("resolved alerts are kept at least 90 days, longer when the company keeps data longer", async () => {
  assert.equal(RESOLVED_ALERT_MIN_RETENTION_DAYS, 90);
  assert.equal(resolvedAlertRetentionDays(30), 90);
  assert.equal(resolvedAlertRetentionDays(365), 365);
  assert.equal(resolvedAlertRetentionDays(undefined), 90);

  await purgeExpiredRecords();
  const left = db.alerts.map((a) => a.id).sort();
  // co-a keeps 365 days: only the 400-day-old resolved alert goes.
  // co-b keeps 30 days of data, but alerts still get 90: the 100-day one goes.
  // Open alerts are never purged, however old.
  assert.deepEqual(left, ["b-resolved-60d", "message", "open-old", "resolved-120d", "resolved-40d", "resolved-recent"]);
});

test("the alert list has every open alert plus recent resolved history, never driver messages", async () => {
  const r = await call("GET", "/api/alerts", { as: "owner-a" });
  assert.equal(r.status, 200);
  const ids = r.body.map((a) => a._id);
  assert.ok(ids.includes("open-old"), "a 200-day-old open alert still shows");
  assert.ok(ids.includes("resolved-recent"));
  assert.ok(ids.includes("resolved-40d"));
  assert.ok(!ids.includes("resolved-120d"), "older than the default 90-day window");
  assert.ok(!ids.includes("message"));
  assert.equal(ids[0], "resolved-recent", "newest first");

  const year = await call("GET", "/api/alerts?days=365", { as: "owner-a" });
  assert.ok(year.body.some((a) => a._id === "resolved-120d"));
});

test("a vehicle says whether it has a tracker token, never the token", async () => {
  const withToken = await call("GET", "/api/vehicles/veh-token", { as: "owner-a" });
  assert.equal(withToken.status, 200);
  assert.equal(withToken.body.hasTrackerToken, true);
  assert.ok(!JSON.stringify(withToken.body).includes("secret-token-value"));
  const without = await call("GET", "/api/vehicles/veh-none", { as: "owner-a" });
  assert.equal(without.body.hasTrackerToken, false);
});
