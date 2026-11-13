import { test } from "node:test";
import assert from "node:assert/strict";
import { staffRoleAllows, staffAccessDenial, canManageTeam, canOpenHr, hasMyHr } from "../lib/staffRoles.js";
import { sendStaffRow, staffEventData, realEmail, parseStaffKey, staffKey } from "../lib/platform/staffEvents.js";
import { makeHrHandlers } from "../lib/platform/hrAccess.js";

// Staff roles (FLEET_HR_CONTRACT.md section 0) and Fleet's side of Figbloom
// HR (section 3): fleet.staff.* events, HR & Payroll and My HR.

test("each staff role may only do its own work", () => {
  const can = (role, method, path) => staffRoleAllows(role, method, path);
  // operator runs the day, doesn't change the fleet
  assert.ok(can("OPERATOR", "POST", "/api/jobs"));
  assert.ok(can("OPERATOR", "PATCH", "/api/jobs/j1"));
  assert.ok(can("OPERATOR", "POST", "/api/messages/threads/t1"));
  assert.ok(can("OPERATOR", "GET", "/api/vehicles"));
  assert.ok(!can("OPERATOR", "PATCH", "/api/vehicles/v1"));
  assert.ok(!can("OPERATOR", "POST", "/api/auth/users"));
  assert.ok(!can("OPERATOR", "PUT", "/api/companies/me/settings"));
  assert.ok(!can("OPERATOR", "GET", "/api/billing/transactions/mine"));
  // accountant: money, read-only fleet
  assert.ok(can("ACCOUNTANT", "GET", "/api/expenses"));
  assert.ok(can("ACCOUNTANT", "POST", "/api/billing/checkout"));
  assert.ok(can("ACCOUNTANT", "POST", "/api/hr/handoff"));
  assert.ok(!can("ACCOUNTANT", "POST", "/api/jobs"));
  assert.ok(!can("ACCOUNTANT", "GET", "/api/messages/threads"));
  // mechanic: maintenance, inspections, defects
  assert.ok(can("MECHANIC", "POST", "/api/maintenance"));
  assert.ok(can("MECHANIC", "POST", "/api/inspections/i1/review"));
  assert.ok(can("MECHANIC", "PATCH", "/api/alerts/a1/resolve"));
  assert.ok(!can("MECHANIC", "PATCH", "/api/vehicles/v1"));
  assert.ok(!can("MECHANIC", "POST", "/api/alerts"));
  // supervisor: reads everything, closes alerts and inspections only
  for (const p of ["/api/jobs", "/api/messages/threads", "/api/expenses", "/api/inspections", "/api/reports/x"]) assert.ok(can("SUPERVISOR", "GET", p), p);
  assert.ok(can("SUPERVISOR", "PATCH", "/api/alerts/a1/resolve"));
  assert.ok(can("SUPERVISOR", "POST", "/api/inspections/i1/review"));
  assert.ok(!can("SUPERVISOR", "POST", "/api/jobs"));
  assert.ok(!can("SUPERVISOR", "GET", "/api/users/team"));
  assert.ok(!can("SUPERVISOR", "GET", "/api/billing/transactions/mine"));
  // everyone: own profile and own leave; not someone else's path
  for (const role of ["OPERATOR", "ACCOUNTANT", "MECHANIC", "SUPERVISOR"]) {
    assert.ok(can(role, "PATCH", "/api/users/me"));
    assert.ok(can(role, "GET", "/api/hr/my/payslips"));
    assert.ok(can(role, "POST", "/api/hr/my/leave/applications"));
    assert.ok(can(role, "POST", "/api/hr/my/leave/applications/77/cancel"));
    assert.ok(!can(role, "PATCH", "/api/users/u2/status"));
    assert.ok(!can(role, "GET", "/api/users/admins"));
    assert.ok(!can(role, "GET", "/api/companies/me/settings"), "settings are not under /api/companies/me");
  }
  assert.ok(!can("OWNER", "GET", "/api/vehicles"), "unknown roles get nothing");
});

test("the 403 reads as a sentence, and other roles are untouched", () => {
  const req = (role, method, url) => ({ user: { role }, method, originalUrl: url });
  assert.match(staffAccessDenial(req("MECHANIC", "PATCH", "/api/vehicles/v1?x=1")), /mechanic account can't change this/);
  assert.match(staffAccessDenial(req("ACCOUNTANT", "GET", "/api/messages/threads")), /accountant account can't open this/);
  assert.equal(staffAccessDenial(req("ACCOUNTANT", "GET", "/api/expenses?from=2026-11-01")), null);
  assert.equal(staffAccessDenial(req("COMPANY_OWNER", "DELETE", "/api/vehicles/v1")), null);
  assert.equal(staffAccessDenial(req("ADMIN", "DELETE", "/api/vehicles/v1")), null);
});

test("who manages the team, opens HR & Payroll and has My HR", () => {
  const owner = { role: "COMPANY_OWNER", companyId: "c1" };
  const full = { role: "ADMIN", adminAccess: "full", companyId: "c1" };
  const viewer = { role: "ADMIN", adminAccess: "viewer", companyId: "c1" };
  const acct = { role: "ACCOUNTANT", companyId: "c1" };
  const driver = { role: "DRIVER", companyId: "c1" };
  const support = { ...owner, support: { sessionId: "s" } };
  assert.deepEqual([owner, full, viewer, acct, support].map(canManageTeam), [true, true, false, false, false]);
  assert.deepEqual([owner, full, viewer, acct, driver, support].map(canOpenHr), [true, true, false, true, false, false]);
  assert.deepEqual([owner, viewer, driver, support, { role: "PLATFORM_ADMIN", companyId: null }].map(hasMyHr), [true, true, true, false, false]);
});

// ---- fleet.staff.*

function staffSetup(people) {
  const sent = [];
  const linked = new Set();
  const deps = {
    client: { postEvent: async (e) => sent.push(e) },
    loadPerson: async (id) => people[id] ?? null,
    links: { has: async (id) => linked.has(id), set: async (id) => linked.add(id), clear: async (id) => linked.delete(id) },
    now: Date.parse("2026-11-12T10:00:00Z"),
  };
  return { sent, linked, send: (row) => sendStaffRow(row, deps) };
}

test("a person goes to HR as created, then updated, then left", async () => {
  const person = { id: "u1", companyId: "c1", fullName: " Amina W ", phone: "+254700000001", email: "Amina@Acme.co.ke", role: "MECHANIC", status: "active" };
  const people = { u1: person };
  const { sent, linked, send } = staffSetup(people);
  await send({ localId: "u1", companyId: "c1", version: 1 });
  person.phone = "+254700000002";
  await send({ localId: "u1", companyId: "c1", version: 2 });
  person.status = "inactive";
  await send({ localId: "u1", companyId: "c1", version: 3 });
  assert.deepEqual(sent.map((e) => e.type), ["fleet.staff.created", "fleet.staff.updated", "fleet.staff.left"]);
  // one outbox row per membership: the company is in the id (FLEET_MEMBERSHIPS_CONTRACT.md section 4)
  assert.deepEqual(sent.map((e) => e.id), ["fleet-staff-u1-c1-1", "fleet-staff-u1-c1-2", "fleet-staff-u1-c1-3"]);
  assert.deepEqual(sent[0].data, { person_id: "u1", full_name: "Amina W", phone: "+254700000001", email: "amina@acme.co.ke", role: "mechanic", job_title: "Mechanic" });
  assert.equal(sent[0].tenant_local_id, "c1");
  assert.deepEqual(sent[2].data, { person_id: "u1", left_on: "2026-11-12" });
  assert.equal(linked.size, 0);
});

test("someone HR never heard of isn't sent as left; a deleted person still is", async () => {
  const people = { off: { id: "off", companyId: "c1", role: "DRIVER", status: "inactive" }, u2: { id: "u2", companyId: "c1", fullName: "Otieno", role: "DRIVER", status: "active" } };
  const { sent, send } = staffSetup(people);
  assert.deepEqual(await send({ localId: "off", companyId: "c1", version: 1 }), { sent: false });
  await send({ localId: "u2", companyId: "c1", version: 1 });
  delete people.u2; // deleted since; the row kept the company
  assert.deepEqual(await send({ localId: "u2", companyId: "c1", version: 2 }), { sent: true, type: "left" });
  assert.deepEqual(sent.map((e) => [e.type, e.tenant_local_id]), [["fleet.staff.created", "c1"], ["fleet.staff.left", "c1"]]);
});

test("someone in two fleets is one HR person in each fleet; leaving one fleet only leaves that one", async () => {
  // loadPerson answers for the membership: the person in that company
  const memberships = {
    "x:c1": { id: "x", companyId: "c1", fullName: "Xavier", email: "x@acme.co.ke", role: "ACCOUNTANT", status: "active" },
    "x:c2": { id: "x", companyId: "c2", fullName: "Xavier", email: "x@acme.co.ke", role: "SUPERVISOR", status: "active" },
  };
  const sent = [];
  const linked = new Set();
  const send = (row) =>
    sendStaffRow(row, {
      client: { postEvent: async (e) => sent.push(e) },
      loadPerson: async (userId, companyId) => memberships[`${userId}:${companyId}`] ?? null,
      links: { has: async (k) => linked.has(k), set: async (k) => linked.add(k), clear: async (k) => linked.delete(k) },
      now: Date.parse("2026-11-13T10:00:00Z"),
    });
  await send({ localId: staffKey("x", "c1"), companyId: "c1", version: 1 });
  await send({ localId: staffKey("x", "c2"), companyId: "c2", version: 1 });
  memberships["x:c1"].status = "inactive"; // disabled in fleet c1
  await send({ localId: staffKey("x", "c1"), companyId: "c1", version: 2 });
  assert.deepEqual(
    sent.map((e) => [e.type, e.tenant_local_id, e.data.person_id, e.data.role ?? null]),
    [
      ["fleet.staff.created", "c1", "x", "accountant"],
      ["fleet.staff.created", "c2", "x", "supervisor"],
      ["fleet.staff.left", "c1", "x", null],
    ]
  );
  assert.deepEqual([...linked], ["x:c2"]);
  // rows queued before memberships (localId = user id) still name their company
  assert.deepEqual(parseStaffKey("u9", "c7"), { userId: "u9", companyId: "c7" });
  assert.deepEqual(parseStaffKey("u9:c8", "c7"), { userId: "u9", companyId: "c8" });
});

test("made-up addresses are never sent as email", () => {
  assert.equal(realEmail("driver1@demo.fleet.internal"), null);
  assert.equal(realEmail("x@example.com"), null);
  assert.equal(realEmail("not-an-email"), null);
  assert.equal(staffEventData({ id: "u", fullName: "A", role: "DRIVER", email: "a@test" }).email, null);
});

// ---- HR & Payroll and My HR

function response() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  res.send = (b) => ((res.body = b), res);
  res.set = (k, v) => ((res.headers[k] = v), res);
  return res;
}

const ENV = { HR_INTEGRATION_ENABLED: "true", HR_MY_HR_URL: "https://hr.example.org/api/integrations/my-hr" };
const PEOPLE = { o1: { id: "o1", fullName: "Wanjiru", email: "wanjiru@acme.co.ke", role: "COMPANY_OWNER" } };

function hr({ env = ENV, handoffAnswer, upstream } = {}) {
  const calls = { handoffs: [], fetches: [] };
  const client = {
    accessToken: async () => "platform-token",
    createHandoff: async (body) => {
      calls.handoffs.push(body);
      if (handoffAnswer instanceof Error) throw handoffAnswer;
      return handoffAnswer ?? { url: "https://hr.example.org/handoff?code=abc", expires_at: "2026-11-12T10:01:00Z" };
    },
  };
  const fetch = async (url, init) => {
    calls.fetches.push({ url, init });
    return upstream ?? new Response(JSON.stringify({ status: "active", name: "Wanjiru" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const db = { user: { findUnique: async ({ where }) => PEOPLE[where.id] ?? null } };
  return { calls, h: makeHrHandlers({ db, getClient: () => client, env, fetch, log: { error() {} } }) };
}

const call = async (fn, req) => {
  const res = response();
  await fn({ query: {}, body: {}, method: "GET", path: "/", ...req }, res);
  return res;
};

test("HR & Payroll: a one-time link for the owner; refused for others and when HR is off", async () => {
  const { calls, h } = hr();
  const owner = { id: "o1", role: "COMPANY_OWNER", companyId: "c1" };
  const res = await call(h.handoff, { user: owner, method: "POST", body: { returnTo: "/payroll" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.url, "https://hr.example.org/handoff?code=abc");
  assert.deepEqual(calls.handoffs[0], {
    target: "hr",
    tenant_local_id: "c1",
    person: { external_id: "o1", name: "Wanjiru", email: "wanjiru@acme.co.ke", role: "company_owner" },
    return_to: "/payroll",
  });
  assert.equal((await call(h.handoff, { user: { id: "m", role: "MECHANIC", companyId: "c1" }, method: "POST" })).statusCode, 403);
  assert.equal((await call(h.handoff, { user: { ...owner, support: { sessionId: "s" } }, method: "POST" })).statusCode, 403);
  assert.equal((await call(hr({ env: {} }).h.handoff, { user: owner, method: "POST" })).statusCode, 404);
  const notSetUp = hr({ handoffAnswer: Object.assign(new Error("no"), { status: 409, code: "target_not_enabled" }) });
  const r = await call(notSetUp.h.handoff, { user: owner, method: "POST" });
  assert.equal(r.statusCode, 409);
  assert.equal(r.body.code, "hr_not_enabled_for_company");
});

test("My HR asks HR as the signed-in person only, on the listed routes only", async () => {
  const { calls, h } = hr();
  const driver = { id: "d1", role: "DRIVER", companyId: "c1" };
  const res = await call(h.myHr, { user: driver, path: "/summary", query: { person: "someone-else" }, headers: { "x-figbloom-person": "evil" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.name, "Wanjiru");
  const { url, init } = calls.fetches[0];
  assert.equal(url, "https://hr.example.org/api/integrations/my-hr/summary");
  assert.equal(init.headers.authorization, "Bearer platform-token");
  assert.equal(init.headers["x-figbloom-company"], "c1");
  assert.equal(init.headers["x-figbloom-person"], "d1");

  await call(h.myHr, { user: driver, path: "/attendance", query: { from: "2026-11-01", to: "2026-11-30", x: "1" } });
  assert.equal(calls.fetches[1].url, "https://hr.example.org/api/integrations/my-hr/attendance?from=2026-11-01&to=2026-11-30");

  const apply = await call(h.myHr, { user: driver, method: "POST", path: "/leave/applications", body: { type_id: 3, start_date: "2026-11-20", end_date: "2026-11-21", reason: "Family" } });
  assert.equal(apply.statusCode, 200);
  assert.equal(calls.fetches[2].init.body, JSON.stringify({ type_id: 3, start_date: "2026-11-20", end_date: "2026-11-21", reason: "Family" }));

  for (const path of ["/approvals", "/import/leave-history", "/../admin", "/payslips/1/../../x"]) {
    assert.equal((await call(h.myHr, { user: driver, path })).statusCode, 404, path);
  }
  assert.equal(calls.fetches.length, 3);
  assert.equal((await call(h.myHr, { user: { ...driver, support: { sessionId: "s" } }, path: "/summary" })).statusCode, 403);
  assert.equal((await call(hr({ env: { HR_INTEGRATION_ENABLED: "true" } }).h.myHr, { user: driver, path: "/summary" })).statusCode, 503);
});

test("My HR passes HR's refusals on, and hides HR's own failures", async () => {
  const user = { id: "d1", role: "DRIVER", companyId: "c1" };
  const notLinked = hr({ upstream: new Response(JSON.stringify({ error: { code: "not_linked", message: "Your HR record isn't ready yet." } }), { status: 404 }) });
  const r1 = await call(notLinked.h.myHr, { user, path: "/summary" });
  assert.equal(r1.statusCode, 404);
  assert.deepEqual(r1.body, { error: "Your HR record isn't ready yet.", code: "not_linked" });
  const rules = hr({ upstream: new Response(JSON.stringify({ error: { code: "leave_rules", message: "Too few days left.", problems: ["Too few days left."] } }), { status: 422 }) });
  const r0 = await call(rules.h.myHr, { user, method: "POST", path: "/leave/applications", body: {} });
  assert.deepEqual(r0.body, { problems: ["Too few days left."], error: "Too few days left.", code: "leave_rules" });
  const broken = hr({ upstream: new Response("boom", { status: 500 }) });
  const r2 = await call(broken.h.myHr, { user, path: "/summary" });
  assert.equal(r2.statusCode, 502);
  assert.equal((await call(broken.h.myHr, { user, path: "/payslips/12/pdf" })).statusCode, 404, "HR makes no PDFs; the web app prints");
});

test("status tells the web app what to show", async () => {
  const { h } = hr();
  const r = await call(h.status, { user: { id: "a", role: "ACCOUNTANT", companyId: "c1" } });
  assert.deepEqual(r.body, { enabled: true, canOpenHr: true, hasMyHr: true });
  const off = await call(hr({ env: {} }).h.status, { user: { id: "a", role: "ACCOUNTANT", companyId: "c1" } });
  assert.deepEqual(off.body, { enabled: false, canOpenHr: false, hasMyHr: false });
});
