import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHrHandlers } from "../lib/platform/hrAccess.js";
import { PlatformError } from "../lib/platform/client.js";
import { companySummaries } from "../lib/platform/summaries.js";
import { staffRoleAllows } from "../lib/staffRoles.js";

// HR connect: whether Figbloom HR is there for a company (GET /api/hr/status
// connection), asking Figbloom for it (POST /api/hr/request), the handoff's
// distinct refusals, and the request in the console's company summaries.

function response() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
}

const call = async (fn, req) => {
  const res = response();
  await fn({ query: {}, body: {}, method: "GET", path: "/", ...req }, res);
  return res;
};

const ENV = { HR_INTEGRATION_ENABLED: "true" };
const OWNER = { id: "o1", role: "COMPANY_OWNER", companyId: "c1" };

// platform: { module: answer | Error, link: answer | Error }
function setup({ env = ENV, tenantId = "t1", platform = {}, client = true, company = {} } = {}) {
  const calls = { modules: 0, links: 0 };
  const clock = { now: Date.parse("2026-11-24T10:00:00Z") };
  const companies = { c1: { id: "c1", hrRequestedAt: null, hrRequestedById: null, ...company } };
  const answer = (a) => {
    if (a instanceof Error) throw a;
    return a;
  };
  const fake = {
    getTenantModule: async (id, module) => {
      calls.modules++;
      assert.equal(id, tenantId);
      assert.equal(module, "hr");
      return answer(platform.module ?? { module_status: "active", cache_seconds: 300 });
    },
    getTenantLink: async (id, module) => {
      calls.links++;
      assert.equal(module, "hr");
      return answer(platform.link ?? { local_tenant_id: "hr-9" });
    },
    createHandoff: async () => answer(platform.handoff ?? { url: "https://hr.example.org/h?code=x", expires_at: null }),
  };
  const db = {
    platformLink: {
      async findUnique({ where }) {
        const { kind, localId } = where.kind_localId;
        return kind === "tenant" && localId === "c1" && tenantId ? { platformId: tenantId } : null;
      },
    },
    company: {
      async findUnique({ where }) {
        return companies[where.id] ? { ...companies[where.id] } : null;
      },
      async updateMany({ where, data }) {
        const c = companies[where.id];
        if (!c || ("hrRequestedAt" in where && c.hrRequestedAt !== where.hrRequestedAt)) return { count: 0 };
        Object.assign(c, data);
        return { count: 1 };
      },
    },
    user: { findUnique: async () => ({ id: "o1", fullName: "Wanjiru", email: "wanjiru@acme.co.ke" }) },
  };
  const h = makeHrHandlers({ db, getClient: () => (client ? fake : null), env, log: { error() {} }, now: () => clock.now });
  return { h, calls, clock, companies };
}

const notFound = (code) => new PlatformError("no", 404, code);

test("status: connected, setting up, not connected and unknown", async () => {
  const connected = await call(setup().h.status, { user: OWNER });
  assert.deepEqual(connected.body, { enabled: true, canOpenHr: true, hasMyHr: false, canRequestHr: true, connection: "connected", requestedAt: null });

  const settingUp = await call(setup({ platform: { link: notFound("not_linked") } }).h.status, { user: OWNER });
  assert.equal(settingUp.body.connection, "setting_up");

  for (const module_status of ["trial", "suspended", "cancelled", null]) {
    const r = await call(setup({ platform: { module: { module_status } } }).h.status, { user: OWNER });
    assert.equal(r.body.connection, "not_connected", String(module_status));
  }

  const noTenant = setup({ tenantId: null });
  assert.equal((await call(noTenant.h.status, { user: OWNER })).body.connection, "not_connected");
  assert.equal(noTenant.calls.modules, 0, "no platform account: the platform isn't asked");

  const down = await call(setup({ platform: { module: new PlatformError("down", 0, "unreachable") } }).h.status, { user: OWNER });
  assert.equal(down.body.connection, "unknown");
  const linkDown = await call(setup({ platform: { link: new PlatformError("boom", 500, "internal") } }).h.status, { user: OWNER });
  assert.equal(linkDown.body.connection, "unknown");
  assert.equal((await call(setup({ client: false }).h.status, { user: OWNER })).body.connection, "unknown");

  const asked = await call(setup({ company: { hrRequestedAt: new Date("2026-11-20T08:00:00Z") }, platform: { module: { module_status: null } } }).h.status, { user: OWNER });
  assert.equal(asked.body.requestedAt, "2026-11-20T08:00:00.000Z");
});

test("status doesn't ask the platform when HR is off or the person can't open HR", async () => {
  const off = setup({ env: {} });
  const r = await call(off.h.status, { user: OWNER });
  assert.deepEqual(r.body, { enabled: false, canOpenHr: false, hasMyHr: false, canRequestHr: false, connection: null, requestedAt: null });
  const on = setup();
  for (const user of [{ id: "m", role: "MECHANIC", companyId: "c1" }, { id: "v", role: "ADMIN", adminAccess: "viewer", companyId: "c1" }, { ...OWNER, support: { sessionId: "s" } }]) {
    const res = await call(on.h.status, { user });
    assert.equal(res.body.canRequestHr, false);
    assert.equal(res.body.connection, null);
  }
  assert.equal(off.calls.modules + on.calls.modules, 0);
});

test("the connection is kept a minute per company", async () => {
  const { h, calls, clock } = setup();
  await call(h.status, { user: OWNER });
  await call(h.status, { user: { id: "a", role: "ACCOUNTANT", companyId: "c1" } });
  assert.deepEqual(calls, { modules: 1, links: 1 });
  clock.now += 59_000;
  await call(h.status, { user: OWNER });
  assert.equal(calls.modules, 1);
  clock.now += 2_000; // the platform said 300 s; a minute at most
  await call(h.status, { user: OWNER });
  assert.equal(calls.modules, 2);
});

test("request: stored once, refused when HR is already there, for the same people as HR", async () => {
  const s = setup({ platform: { module: { module_status: null } } });
  const first = await call(s.h.request, { user: OWNER, method: "POST" });
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body, { requestedAt: "2026-11-24T10:00:00.000Z" });
  assert.equal(s.companies.c1.hrRequestedById, "o1");
  s.clock.now += 3_600_000;
  const again = await call(s.h.request, { user: { id: "a", role: "ACCOUNTANT", companyId: "c1" }, method: "POST" });
  assert.deepEqual(again.body, { requestedAt: "2026-11-24T10:00:00.000Z" }, "the first request is kept");
  assert.equal(s.companies.c1.hrRequestedById, "o1");
  const status = await call(s.h.status, { user: OWNER });
  assert.equal(status.body.requestedAt, "2026-11-24T10:00:00.000Z");
  assert.equal(status.body.connection, "not_connected");

  for (const platform of [{}, { link: notFound("not_linked") }]) {
    const r = await call(setup({ platform }).h.request, { user: OWNER, method: "POST" });
    assert.equal(r.statusCode, 409);
    assert.equal(r.body.code, "already_connected");
  }
  assert.equal((await call(setup().h.request, { user: { id: "m", role: "MECHANIC", companyId: "c1" }, method: "POST" })).statusCode, 403);
  assert.equal((await call(setup().h.request, { user: { ...OWNER, support: { sessionId: "s" } }, method: "POST" })).statusCode, 403);
  assert.equal((await call(setup({ env: {} }).h.request, { user: OWNER, method: "POST" })).statusCode, 404);
  // the platform can't be asked: the request is still taken
  assert.equal((await call(setup({ client: false }).h.request, { user: OWNER, method: "POST" })).statusCode, 200);
  // accountants may send it (staff role permissions)
  assert.ok(staffRoleAllows("ACCOUNTANT", "POST", "/api/hr/request"));
  assert.ok(!staffRoleAllows("SUPERVISOR", "POST", "/api/hr/request"));
});

test("a request forgets the remembered connection", async () => {
  const s = setup({ platform: { module: { module_status: null } } });
  await call(s.h.status, { user: OWNER });
  await call(s.h.request, { user: OWNER, method: "POST" });
  await call(s.h.status, { user: OWNER });
  assert.equal(s.calls.modules, 2);
});

test("handoff refusals each have their own code", async () => {
  const codeFor = async (err) => {
    const r = await call(setup({ platform: { handoff: err } }).h.handoff, { user: OWNER, method: "POST" });
    return [r.statusCode, r.body.code];
  };
  assert.deepEqual(await codeFor(new PlatformError("x", 409, "target_not_enabled")), [409, "hr_not_enabled_for_company"]);
  assert.deepEqual(await codeFor(new PlatformError("x", 404, "tenant_not_found")), [409, "hr_not_enabled_for_company"]);
  assert.deepEqual(await codeFor(new PlatformError("x", 409, "target_not_linked")), [409, "hr_setting_up"]);
  assert.deepEqual(await codeFor(new PlatformError("x", 429, "rate_limited")), [429, "rate_limited"]);
  assert.deepEqual(await codeFor(new PlatformError("x", 502, "http_502")), [502, "platform_unavailable"]);
  assert.deepEqual(await codeFor(new PlatformError("x", 409, "target_no_handoff_url")), [502, "platform_unavailable"]);
});

test("console summaries say when the company asked for HR", async () => {
  const requested = new Date("2026-11-20T08:00:00Z");
  let select;
  const db = {
    company: {
      async findMany(args) {
        select = args.select;
        return [
          { id: "c1", name: "Acme", slug: "acme", status: "active", industry: "other", subscriptionPlan: "trial", trialEndsAt: null, createdAt: requested, hrRequestedAt: requested, memberships: [] },
          { id: "c2", name: "Beta", slug: "beta", status: "active", industry: "other", subscriptionPlan: "trial", trialEndsAt: null, createdAt: requested, hrRequestedAt: null, memberships: [] },
        ];
      },
    },
    membership: { groupBy: async () => [] },
    vehicle: { findMany: async () => [] },
    trip: { groupBy: async () => [] },
    platformLink: { findMany: async () => [] },
  };
  const rows = await companySummaries(db);
  assert.equal(select.hrRequestedAt, true);
  assert.deepEqual(rows.map((r) => r.hrRequestedAt), [requested, null]);
});
