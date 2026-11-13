import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEventWebhookHandler } from "../lib/platform/eventWebhook.js";
import { applyEmployeeLeft, applyLeaveEvent, leaveWarning } from "../lib/platform/hrEvents.js";
import { signFigbloomWebhook } from "../lib/platform/signature.js";
import { migrateLegacyUsers } from "./helpers/memoryModel.js";

// POST /api/platform/events (FLEET_HR_CONTRACT.md section 3): Figbloom HR's
// hr.employee.left and hr.leave.* through the platform relay, over an
// in-memory database.

function hrDb({ extraMemberships = [] } = {}) {
  // people as the memberships migration leaves them (one membership each)
  const { users, memberships } = migrateLegacyUsers([
    { id: "owner", companyId: "c1", role: "COMPANY_OWNER", status: "active" },
    { id: "drv", companyId: "c1", role: "DRIVER", status: "active" },
    { id: "mech", companyId: "c1", role: "MECHANIC", status: "active" },
    { id: "other", companyId: "c2", role: "DRIVER", status: "active" },
  ]);
  let state = {
    companies: [{ id: "c1" }, { id: "c2" }],
    users,
    memberships: [...memberships, ...extraMemberships],
    tokens: [{ userId: "drv", revoked: false }],
    links: [{ kind: "staff", localId: "drv:c1" }],
    deliveries: [],
    leave: [],
  };
  let seq = 0;
  const db = {
    state: () => state,
    async $transaction(fn) {
      const snapshot = structuredClone(state);
      try {
        return await fn(db);
      } catch (err) {
        state = snapshot;
        throw err;
      }
    },
    company: { findUnique: async ({ where }) => state.companies.find((c) => c.id === where.id) ?? null },
    user: {
      findUnique: async ({ where }) => {
        const u = state.users.find((x) => x.id === where.id);
        return u ? { ...u } : null;
      },
      update: async ({ where, data }) => Object.assign(state.users.find((x) => x.id === where.id), data),
    },
    membership: {
      findUnique: async ({ where }) => {
        const k = where.userId_companyId;
        const m = state.memberships.find((x) => x.userId === k.userId && x.companyId === k.companyId);
        return m ? { ...m } : null;
      },
      update: async ({ where, data }) => Object.assign(state.memberships.find((x) => x.id === where.id), data),
      count: async ({ where }) => state.memberships.filter((x) => x.userId === where.userId && x.status === where.status).length,
    },
    refreshToken: {
      updateMany: async ({ where, data }) => {
        const hit = state.tokens.filter((t) => t.userId === where.userId && t.revoked === where.revoked);
        hit.forEach((t) => Object.assign(t, data));
        return { count: hit.length };
      },
    },
    platformLink: {
      deleteMany: async ({ where }) => {
        state.links = state.links.filter((l) => !(l.kind === where.kind && l.localId === where.localId));
      },
    },
    platformEventDelivery: {
      create: async ({ data }) => {
        if (state.deliveries.some((d) => d.deliveryId === data.deliveryId)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        state.deliveries.push({ ...data });
      },
      update: async ({ where, data }) => Object.assign(state.deliveries.find((d) => d.deliveryId === where.deliveryId), data),
    },
    driverUnavailability: {
      findUnique: async ({ where }) => {
        const k = where.companyId_source_applicationId;
        const r = state.leave.find((l) => l.companyId === k.companyId && l.source === k.source && l.applicationId === k.applicationId);
        return r ? { ...r } : null;
      },
      create: async ({ data }) => state.leave.push({ id: `l${++seq}`, ...data }),
      update: async ({ where, data }) => Object.assign(state.leave.find((l) => l.id === where.id), data),
      findMany: async ({ where }) =>
        state.leave.filter(
          (l) =>
            l.companyId === where.companyId &&
            l.status === where.status &&
            l.startDate <= where.startDate.lte &&
            l.endDate >= where.endDate.gte &&
            (!where.userId || where.userId.in.includes(l.userId))
        ),
    },
  };
  return db;
}

const SECRET = "whsec-test-0123456789abcdef0123456789abcdef";
const ON = { PLATFORM_WEBHOOK_SECRET: SECRET, HR_INTEGRATION_ENABLED: "true" };

function request(event, { delivery = "d1", secret = SECRET } = {}) {
  const raw = JSON.stringify({ event, delivered_at: "2026-11-12T10:00:00.000Z" });
  const signed = signFigbloomWebhook(secret, raw);
  const headers = { "x-figbloom-event": event.type, "x-figbloom-delivery": delivery, "x-figbloom-signature": signed.signature, "x-figbloom-timestamp": signed.timestamp };
  return { body: Buffer.from(raw), get: (name) => headers[name.toLowerCase()] };
}

function response() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  res.set = (k, v) => ((res.headers[k] = v), res);
  return res;
}

const membershipOf = (state, userId, companyId = "c1") => state.memberships.find((m) => m.userId === userId && m.companyId === companyId);

function setup(env = ON, opts) {
  const db = hrDb(opts);
  const logs = { debug: [], warn: [], error: [] };
  const log = { debug: (m) => logs.debug.push(m), log: (m) => logs.debug.push(m), warn: (m) => logs.warn.push(m), error: (m) => logs.error.push(m) };
  const handle = makeEventWebhookHandler({ db, applyEmployeeLeft, applyLeaveEvent, env, log });
  const send = async (event, opts) => {
    const res = response();
    await handle(request(event, opts), res);
    return res;
  };
  return { db, logs, send };
}

const left = (externalId, tenant = "c1") => ({ type: "hr.employee.left", id: `e-${externalId}`, occurred_at: "2026-11-12T09:00:00.000Z", source: "hr", tenant_local_id: tenant, data: { employee_number: "EMP-1", external_id: externalId, left_on: "2026-11-12" } });
const leave = (type, { start = "2026-11-20", end = "2026-11-22", at = "2026-11-12T09:00:00.000Z", person = "drv", app = "A1" } = {}) => ({
  type, id: `${type}-${start}-${at}`, occurred_at: at, source: "hr", tenant_local_id: "c1",
  data: { application_id: app, external_id: person, employee_number: "EMP-1", leave_type: "Annual leave", start_date: start, end_date: end, half_day: false, days: 3, status: type.endsWith("approved") ? "approved" : "cancelled" },
});

test("hr.employee.left deactivates the person once and revokes their sessions", async () => {
  const { db, send } = setup();
  const res = await send(left("drv"));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.outcome, "deactivated");
  const s = db.state();
  assert.equal(membershipOf(s, "drv").status, "disabled");
  assert.equal(s.tokens[0].revoked, true);
  assert.equal(s.links.length, 0, "not reported back to HR as fleet.staff.left");
  const again = await send(left("drv"));
  assert.equal(again.statusCode, 200);
  assert.equal(again.body.outcome, "duplicate");
});

test("the company owner is never deactivated from HR: acknowledged and logged", async () => {
  const { db, logs, send } = setup();
  const res = await send(left("owner"));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.outcome, "owner_ignored");
  assert.equal(membershipOf(db.state(), "owner").status, "active");
  assert.equal(logs.warn.length, 1);
});

test("events about a tenant or person Fleet doesn't know are acknowledged 2xx and ignored", async () => {
  const { db, logs, send } = setup();
  const cases = [
    left("schools-person-uuid", "c1"), // a Schools person (unknown in Fleet)
    left("drv", "schools-tenant-9"), // a company Fleet doesn't have
    { ...left("drv"), tenant_local_id: null }, // account not linked to Fleet
    leave("hr.leave.approved", { person: "nobody" }),
    { ...leave("hr.leave.approved"), tenant_local_id: "unknown-co" },
    { ...left("x"), data: { employee_number: "EMP-9" } }, // no external id at all
  ];
  for (const [i, event] of cases.entries()) {
    const res = await send(event, { delivery: `backlog-${i}` });
    assert.ok(res.statusCode >= 200 && res.statusCode < 300, `case ${i} answered ${res.statusCode}`);
    assert.equal(res.body.applied, false);
    assert.equal(res.body.ignored, true);
  }
  assert.equal(membershipOf(db.state(), "drv").status, "active");
  assert.equal(db.state().leave.length, 0);
  assert.equal(logs.debug.length, cases.length, "each logged at debug level");
  assert.equal(logs.warn.length + logs.error.length, 0);
  // and the backlog doesn't break while HR is off either: 503 (kept and retried), not 4xx
  const off = setup({ PLATFORM_WEBHOOK_SECRET: SECRET });
  assert.equal((await off.send(cases[0])).statusCode, 503);
});

test("a known person of another Fleet company is refused, not applied", async () => {
  const { db, send } = setup();
  const res = await send(left("other", "c1"));
  assert.equal(res.statusCode, 422);
  assert.equal(membershipOf(db.state(), "other", "c2").status, "active");
});

test("approved leave marks the driver unavailable; dispatch gets a warning", async () => {
  const { db, send } = setup();
  assert.equal((await send(leave("hr.leave.approved"))).body.outcome, "approved");
  const warn = await leaveWarning(db, { companyId: "c1", userId: "drv", date: "2026-11-21" });
  assert.equal(warn.code, "driver_on_leave");
  assert.match(warn.message, /Annual leave from 2026-11-20 to 2026-11-22/);
  assert.equal(await leaveWarning(db, { companyId: "c1", userId: "drv", date: "2026-11-23" }), null);
});

test("a date change (cancel old + approve new, either order) keeps the new dates", async () => {
  const { db, send } = setup();
  await send(leave("hr.leave.approved", { at: "2026-11-12T09:00:00Z" }), { delivery: "a" });
  // the new range arrives first, then the cancel of the old range
  await send(leave("hr.leave.approved", { start: "2026-11-25", end: "2026-11-26", at: "2026-11-12T10:00:01Z" }), { delivery: "b" });
  const late = await send(leave("hr.leave.cancelled", { at: "2026-11-12T10:00:00Z" }), { delivery: "c" });
  assert.equal(late.body.outcome, "stale");
  const row = db.state().leave[0];
  assert.deepEqual([row.status, row.startDate, row.endDate], ["approved", "2026-11-25", "2026-11-26"]);
  // a cancel of the current dates cancels it
  const cancel = await send(leave("hr.leave.cancelled", { start: "2026-11-25", end: "2026-11-26", at: "2026-11-12T11:00:00Z" }), { delivery: "d" });
  assert.equal(cancel.body.outcome, "cancelled");
  assert.equal(await leaveWarning(db, { companyId: "c1", userId: "drv", date: "2026-11-25" }), null);
});

test("signature, switch and body checks", async () => {
  const { send } = setup();
  assert.equal((await send(left("drv"), { secret: "wrong-secret-0123456789abcdef0123456789" })).statusCode, 401);
  const off = setup({ PLATFORM_WEBHOOK_SECRET: SECRET });
  const res = await off.send(left("drv"));
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers["Retry-After"], "3600");
  assert.equal(membershipOf(off.db.state(), "drv").status, "active");
  assert.equal((await send({ ...left("drv"), type: "schools.staff.created" })).statusCode, 202);
  assert.equal((await send(leave("hr.leave.approved", { start: "2026-11-22", end: "2026-11-20" }))).statusCode, 400);
});

// ---- memberships (FLEET_MEMBERSHIPS_CONTRACT.md section 4): someone in two fleets

const inBothFleets = { extraMemberships: [{ id: "mbr_drv_c2", userId: "drv", companyId: "c2", role: "SUPERVISOR", status: "active" }] };

test("an HR exit in one fleet disables only that fleet's membership; the other fleet and the sign-in stay", async () => {
  const { db, send } = setup(ON, inBothFleets);
  const res = await send(left("drv", "c1"));
  assert.equal(res.body.outcome, "deactivated");
  const s = db.state();
  assert.equal(membershipOf(s, "drv", "c1").status, "disabled");
  assert.equal(membershipOf(s, "drv", "c2").status, "active", "fleet c2 is untouched");
  assert.equal(s.tokens[0].revoked, false, "still signed in: they have another fleet");
  assert.equal(s.users.find((u) => u.id === "drv").status, "active", "the account itself is not switched off");
});

test("HR leave in one fleet is recorded for that fleet only", async () => {
  const { db, send } = setup(ON, inBothFleets);
  const event = { ...leave("hr.leave.approved"), tenant_local_id: "c2" };
  assert.equal((await send(event)).body.outcome, "approved");
  assert.deepEqual(db.state().leave.map((l) => [l.companyId, l.userId]), [["c2", "drv"]]);
  assert.ok(await leaveWarning(db, { companyId: "c2", userId: "drv", date: "2026-11-21" }));
  assert.equal(await leaveWarning(db, { companyId: "c1", userId: "drv", date: "2026-11-21" }), null);
});
