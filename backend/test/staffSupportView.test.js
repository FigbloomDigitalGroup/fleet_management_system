import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

// Figbloom staff: the read-only support view of one customer fleet, and
// creating a fleet for a client. These run the real routers, middleware and
// controllers over HTTP, with the Prisma client's models swapped for a small
// in-memory store.

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to
for (const key of ["PLATFORM_CLIENT_ID", "PLATFORM_CLIENT_SECRET", "PLATFORM_TOKEN_URL", "PLATFORM_API_URL", "PLATFORM_DECISIONS_ENABLED"]) {
  delete process.env[key];
}

const { default: prisma } = await import("../lib/prisma.js");
const { default: vehicleRoutes } = await import("../routes/vehicleRoutes.js");
const { default: companyRoutes } = await import("../routes/companyRoutes.js");
const { default: billingRoutes } = await import("../routes/billingRoutes.js");
const { default: supportRoutes } = await import("../routes/supportRoutes.js");
const { default: messageRoutes } = await import("../routes/messageRoutes.js");
const { registerDecidedCompany } = await import("../lib/platform/backfill.js");
const { PlatformError } = await import("../lib/platform/client.js");

const USERS = [
  { id: "staff-1", role: "PLATFORM_ADMIN", companyId: null, email: "staff@figbloom.test", fullName: "Staff One", status: "active" },
  { id: "staff-2", role: "PLATFORM_ADMIN", companyId: null, email: "staff2@figbloom.test", fullName: "Staff Two", status: "active" },
  { id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a", email: "owner@a.test", fullName: "Amina", status: "active" },
  { id: "driver-a", role: "DRIVER", companyId: "co-a", email: "driver@a.test", fullName: "Dan", status: "active" },
];

let db;
function reset() {
  db = {
    users: USERS.map((u) => ({ ...u })),
    companies: [
      { id: "co-a", name: "Amina's Fleet", slug: "aminas-fleet", status: "active", subscriptionPlan: "custom" },
      { id: "co-b", name: "Other Fleet", slug: "other-fleet", status: "active", subscriptionPlan: "custom" },
    ],
    vehicles: [
      { id: "veh-a", companyId: "co-a", plateNumber: "KAA 001A", status: "idle", driverId: null, createdAt: new Date() },
      { id: "veh-b", companyId: "co-b", plateNumber: "KBB 002B", status: "idle", driverId: null, createdAt: new Date() },
    ],
    messages: [{ id: "msg-1", companyId: "co-a", driverId: "driver-a", senderId: "driver-a", fromDriver: true, body: "Flat tyre", readAt: null, createdAt: new Date() }],
    supportSessions: [],
    staffAuditLogs: [],
    queued: [],
  };
}

// equality on plain values; { startsWith } for the slug lookup
const fieldMatches = (value, cond) =>
  cond !== null && typeof cond === "object" && !(cond instanceof Date) && "startsWith" in cond
    ? String(value ?? "").startsWith(cond.startsWith)
    : (value ?? null) === cond;
const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => fieldMatches(row[k], v));
let nextId = 1;
function table(name, defaults = {}) {
  return {
    async findUnique({ where }) {
      return db[name].find((r) => matches(r, where)) ?? null;
    },
    async findFirst({ where }) {
      return db[name].find((r) => matches(r, where)) ?? null;
    },
    async findMany({ where, take } = {}) {
      const rows = db[name].filter((r) => matches(r, where));
      return take ? rows.slice(0, take) : rows;
    },
    async count({ where }) {
      return db[name].filter((r) => matches(r, where)).length;
    },
    async create({ data }) {
      const row = { id: `${name}-${nextId++}`, createdAt: new Date(), ...defaults, ...data };
      db[name].push(row);
      return row;
    },
    async update({ where, data }) {
      const row = db[name].find((r) => matches(r, where));
      Object.assign(row, data);
      return row;
    },
    async updateMany({ where, data }) {
      const rows = db[name].filter((r) => matches(r, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    },
    async delete({ where }) {
      db[name] = db[name].filter((r) => !matches(r, where));
    },
  };
}

let server;
let baseUrl;
const saved = {};
const MODELS = ["user", "company", "vehicle", "message", "supportSession", "staffAuditLog", "platformSettings", "locationPing", "transaction", "$transaction", "$executeRaw"];

before(async () => {
  for (const key of MODELS) saved[key] = prisma[key];
  prisma.user = {
    ...table("users", { status: "active" }),
    // The welcome email starts by saving a set-password token; record that
    // it was asked for and stop there, so no test ever sends mail.
    async update({ where, data }) {
      db.welcomeFor = where.id;
      if (data.resetPasswordTokenHash) throw new Error("test: no welcome email");
      return table("users").update({ where, data });
    },
  };
  prisma.company = table("companies");
  prisma.vehicle = table("vehicles");
  prisma.message = table("messages");
  prisma.supportSession = table("supportSessions", { endedAt: null, endReason: null });
  prisma.staffAuditLog = table("staffAuditLogs");
  prisma.transaction = { findMany: async () => [{ id: "tx-1", companyId: "co-a", reference: "card-ref" }] };
  prisma.platformSettings = { findFirst: async () => ({ vehicleLimits: {}, defaultPlan: "trial", trialDays: 14 }) };
  prisma.locationPing = { findFirst: async () => null };
  prisma.$transaction = async (fn) => fn(prisma);
  // enqueueCompanySync's raw INSERT: the localId is the second value
  prisma.$executeRaw = async (_strings, ...values) => {
    db.queued.push(values[1]);
    return 1;
  };

  const app = express();
  app.use(express.json());
  app.use("/api/vehicles", vehicleRoutes);
  app.use("/api/companies", companyRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/support", supportRoutes);
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

const userToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET);

async function call(token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function openFleet(staffId = "staff-1", companyId = "co-a") {
  const res = await call(userToken(staffId), "POST", "/api/support/sessions", { companyId });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

// ---- starting a support view

test("staff open a fleet: a support token for that company, and an audit row", async () => {
  const { token, session } = await openFleet();
  assert.ok(token);
  assert.equal(session.companyId, "co-a");
  assert.equal(session.companyName, "Amina's Fleet");
  assert.ok(new Date(session.expiresAt) > new Date());

  assert.equal(db.supportSessions.length, 1);
  assert.equal(db.supportSessions[0].staffUserId, "staff-1");
  const [row] = db.staffAuditLogs;
  assert.equal(row.action, "support_view_started");
  assert.equal(row.staffUserId, "staff-1");
  assert.equal(row.staffEmail, "staff@figbloom.test");
  assert.equal(row.companyId, "co-a");
  assert.equal(row.sessionId, session.id);
  assert.ok(row.createdAt instanceof Date);
});

test("only Figbloom staff can open a support view", async () => {
  for (const userId of ["owner-a", "driver-a"]) {
    const res = await call(userToken(userId), "POST", "/api/support/sessions", { companyId: "co-b" });
    assert.equal(res.status, 403, userId);
  }
  assert.equal(db.supportSessions.length, 0);
});

test("opening a fleet that doesn't exist is a 404", async () => {
  const res = await call(userToken("staff-1"), "POST", "/api/support/sessions", { companyId: "nope" });
  assert.equal(res.status, 404);
  assert.equal(db.staffAuditLogs.length, 0);
});

// ---- what a support view may do

test("in a support view staff read that company's fleet like its owner", async () => {
  const { token } = await openFleet();
  const list = await call(token, "GET", "/api/vehicles");
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((v) => v._id), ["veh-a"], "only this company's vehicles");
  assert.equal((await call(token, "GET", "/api/vehicles/veh-a")).status, 200);
  const me = await call(token, "GET", "/api/companies/me");
  assert.equal(me.status, 200);
  assert.equal(me.body._id, "co-a");
});

test("another company's data is refused in a support view", async () => {
  const { token } = await openFleet();
  assert.equal((await call(token, "GET", "/api/vehicles/veh-b")).status, 404);
});

test("every write is refused in a support view, and nothing changes", async () => {
  const { token } = await openFleet();
  const attempts = [
    ["POST", "/api/vehicles", { plateNumber: "KCC 333C" }],
    ["PUT", "/api/vehicles/veh-a", { status: "maintenance" }],
    ["DELETE", "/api/vehicles/veh-a"],
    ["PATCH", "/api/companies/me", { name: "Hijacked" }],
    ["POST", "/api/messages", { driverId: "driver-a", body: "hi" }],
  ];
  for (const [method, path, body] of attempts) {
    const res = await call(token, method, path, body);
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.equal(res.body.code, "support_read_only");
  }
  assert.equal(db.vehicles.length, 2);
  assert.equal(db.vehicles[0].status, "idle");
  assert.equal(db.companies[0].name, "Amina's Fleet");
});

test("billing is never shown in a support view, even for reads", async () => {
  const { token } = await openFleet();
  const res = await call(token, "GET", "/api/billing/transactions/mine");
  assert.equal(res.status, 403);
  // the owner themselves still sees it
  assert.equal((await call(userToken("owner-a"), "GET", "/api/billing/transactions/mine")).status, 200);
});

test("reading a driver's messages in a support view doesn't mark them read", async () => {
  const { token } = await openFleet();
  const res = await call(token, "GET", "/api/messages?driverId=driver-a");
  assert.equal(res.status, 200);
  assert.equal(db.messages[0].readAt, null);
});

test("a support token can't use the staff area or start another support view", async () => {
  const { token } = await openFleet();
  assert.equal((await call(token, "GET", "/api/companies")).status, 403);
  assert.equal((await call(token, "GET", "/api/support/audit")).status, 403);
  assert.equal((await call(token, "POST", "/api/support/sessions", { companyId: "co-b" })).status, 403);
});

// ---- ending and expiry

test("exit ends the view: the token stops working and an audit row is written", async () => {
  const { token, session } = await openFleet();
  const res = await call(userToken("staff-1"), "POST", `/api/support/sessions/${session.id}/end`);
  assert.equal(res.status, 200);
  assert.ok(db.supportSessions[0].endedAt);
  assert.equal(db.supportSessions[0].endReason, "exit");
  const ended = db.staffAuditLogs.find((r) => r.action === "support_view_ended");
  assert.equal(ended.staffUserId, "staff-1");
  assert.equal(ended.companyId, "co-a");
  assert.equal(ended.sessionId, session.id);

  const after = await call(token, "GET", "/api/vehicles");
  assert.equal(after.status, 401);
  assert.equal(after.body.code, "support_session_ended");
  // exiting twice is harmless and writes no second row
  assert.equal((await call(userToken("staff-1"), "POST", `/api/support/sessions/${session.id}/end`)).status, 200);
  assert.equal(db.staffAuditLogs.filter((r) => r.action === "support_view_ended").length, 1);
});

test("staff can't end someone else's support view", async () => {
  const { session } = await openFleet("staff-1");
  assert.equal((await call(userToken("staff-2"), "POST", `/api/support/sessions/${session.id}/end`)).status, 404);
  assert.equal(db.supportSessions[0].endedAt, null);
});

test("an expired support view is refused (session row past its expiry)", async () => {
  const { token } = await openFleet();
  db.supportSessions[0].expiresAt = new Date(Date.now() - 1000);
  assert.equal((await call(token, "GET", "/api/vehicles")).status, 401);
});

test("an expired support token is refused (JWT exp)", async () => {
  const { session } = await openFleet();
  const expired = jwt.sign(
    { typ: "support", sid: session.id, staffId: "staff-1", companyId: "co-a", exp: Math.floor(Date.now() / 1000) - 10 },
    process.env.JWT_SECRET
  );
  assert.equal((await call(expired, "GET", "/api/vehicles")).status, 401);
});

test("a support token is bound to its staff member and company", async () => {
  const { session } = await openFleet();
  const forged = (claims) => jwt.sign({ typ: "support", sid: session.id, staffId: "staff-1", companyId: "co-a", ...claims }, process.env.JWT_SECRET);
  assert.equal((await call(forged({ companyId: "co-b" }), "GET", "/api/vehicles")).status, 401);
  assert.equal((await call(forged({ staffId: "staff-2" }), "GET", "/api/vehicles")).status, 401);
});

test("a support view stops working if the staff member loses the staff role", async () => {
  const { token } = await openFleet();
  db.users.find((u) => u.id === "staff-1").role = "COMPANY_OWNER";
  assert.equal((await call(token, "GET", "/api/vehicles")).status, 401);
});

test("opening a second fleet ends the first view", async () => {
  const first = await openFleet("staff-1", "co-a");
  await openFleet("staff-1", "co-b");
  assert.equal(db.supportSessions[0].endReason, "replaced");
  assert.equal((await call(first.token, "GET", "/api/vehicles")).status, 401);
  assert.deepEqual(
    db.staffAuditLogs.map((r) => [r.action, r.companyId]),
    [
      ["support_view_started", "co-a"],
      ["support_view_ended", "co-a"],
      ["support_view_started", "co-b"],
    ]
  );
});

test("staff read the audit log for one company", async () => {
  await openFleet("staff-1", "co-a");
  await openFleet("staff-2", "co-b");
  const res = await call(userToken("staff-1"), "GET", "/api/support/audit?companyId=co-b");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((r) => r.staffEmail), ["staff2@figbloom.test"]);
});

// ---- creating a fleet

test("staff create a fleet: active company, owner with a random password, emailed, queued for the console, audited", async () => {
  const res = await call(userToken("staff-1"), "POST", "/api/support/fleets", {
    fleetName: "Juma Transport",
    ownerName: "Juma Otieno",
    ownerEmail: "  Juma@Example.com ",
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const company = db.companies.find((c) => c.name === "Juma Transport");
  assert.equal(company.status, "active");
  assert.equal(company.slug, "juma-transport");
  assert.equal(company.subscriptionPlan, "trial");

  const owner = db.users.find((u) => u.email === "juma@example.com");
  assert.equal(owner.role, "COMPANY_OWNER");
  assert.equal(owner.companyId, company.id);
  assert.ok(owner.passwordHash && owner.passwordHash.startsWith("$2"), "a hashed random password");
  assert.equal(res.body.owner.passwordHash, undefined);

  // set-password email started (it stops at the token save in tests)
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(db.welcomeFor, owner.id);

  // no PLATFORM_* settings here: queued for the every-minute sync like a registration
  assert.deepEqual(db.queued, [company.id]);
  assert.equal(res.body.platform.queued, true);

  const audit = db.staffAuditLogs.find((r) => r.action === "fleet_created");
  assert.equal(audit.staffUserId, "staff-1");
  assert.equal(audit.companyId, company.id);
});

test("create fleet refuses an email that already has an account, and non-staff", async () => {
  const dup = await call(userToken("staff-1"), "POST", "/api/support/fleets", { fleetName: "X", ownerName: "Y", ownerEmail: "owner@a.test" });
  assert.equal(dup.status, 409);
  const notStaff = await call(userToken("owner-a"), "POST", "/api/support/fleets", { fleetName: "X", ownerName: "Y", ownerEmail: "new@x.test" });
  assert.equal(notStaff.status, 403);
  const bad = await call(userToken("staff-1"), "POST", "/api/support/fleets", { fleetName: "X", ownerName: "Y", ownerEmail: "not-an-email" });
  assert.equal(bad.status, 400);
  assert.equal(db.companies.length, 2);
});

// ---- registering with the Figbloom platform (lib/platform/backfill.js)

function fakeClient({ fail } = {}) {
  const calls = [];
  return {
    calls,
    async putOrganization(id, body) {
      calls.push(["org", id, body]);
      if (fail) throw new PlatformError("platform down", 503, "unavailable");
      return { organization_id: `org-${id}`, status: body.status };
    },
    async putTenant(id, body) {
      calls.push(["tenant", id, body]);
      return { tenant_id: `ten-${id}` };
    },
  };
}

function platformDb(company) {
  const links = [];
  const queued = [];
  return {
    links,
    queued,
    company: { findUnique: async () => ({ ...company, slug: "juma-transport", users: [{ email: "o@x.test" }] }) },
    user: { findFirst: async () => ({ email: "o@x.test" }) },
    platformLink: { upsert: async ({ create }) => links.push(create) },
    $executeRaw: async (_s, ...values) => queued.push(values[1]),
  };
}

test("a staff-created fleet registers with the platform the backfill way: active, then queued", async () => {
  const client = fakeClient();
  const pdb = platformDb({ id: "co-new", name: "Juma Transport", status: "active", createdAt: new Date() });
  const result = await registerDecidedCompany(pdb, client, "co-new", { decisionsOn: true });
  assert.equal(result.result, "registered");
  const [kind, id, body] = client.calls[0];
  assert.equal(kind, "org");
  assert.equal(id, "co-new");
  assert.equal(body.status, "active");
  assert.equal(body.backfill, true);
  assert.equal(client.calls[1][0], "tenant");
  assert.deepEqual(pdb.queued, ["co-new"]);
});

test("with console decisions on, a failed registration is not queued (it would come back pending)", async () => {
  const pdb = platformDb({ id: "co-new", name: "Juma Transport", status: "active", createdAt: new Date() });
  const result = await registerDecidedCompany(pdb, fakeClient({ fail: true }), "co-new", { decisionsOn: true });
  assert.equal(result.result, "error");
  assert.deepEqual(pdb.queued, []);
});
