import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import jwt from "jsonwebtoken";

// Every page in an accountant's menu (Overview, Live map, Vehicles, Drivers,
// Trips, Expenses, Reports incl. the Excel downloads, Billing, HR & Payroll,
// My HR) loads without a role refusal: each API call those pages make,
// through the real routers and middleware. Only who-may-do-what is checked
// here; the data models all fail fast (500), which is fine: a 500 isn't a
// 403. The calls are the ones the web app makes (frontend/app/components/*).

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to
delete process.env.HR_INTEGRATION_ENABLED;

const { default: prisma } = await import("../lib/prisma.js");
const { installMembershipModels, migrateLegacyUsers } = await import("./helpers/memoryModel.js");
const ROUTERS = {
  "/api/users": "userRoutes",
  "/api/companies": "companyRoutes",
  "/api/vehicles": "vehicleRoutes",
  "/api/billing": "billingRoutes",
  "/api/trips": "tripRoutes",
  "/api/alerts": "alertRoutes",
  "/api/tracking": "trackingRoutes",
  "/api/routes": "routeRoutes",
  "/api/geofences": "geofenceRoutes",
  "/api/agent": "agentRoutes",
  "/api/expenses": "expenseRoutes",
  "/api/uploads": "uploadRoutes",
  "/api/inspections": "inspectionRoutes",
  "/api/messages": "messageRoutes",
  "/api/maintenance": "maintenanceRoutes",
  "/api/reports": "reportRoutes",
  "/api/hr": "hrRoutes",
};

// What each accountant page asks the API for.
const ACCOUNTANT_PAGES = {
  "every page (menu, alerts badge, zones, profile, AI helper)": [
    ["GET", "/api/users/me"],
    ["GET", "/api/companies/me"],
    ["GET", "/api/alerts"],
    ["GET", "/api/tracking/live"],
    ["GET", "/api/geofences"],
    ["GET", "/api/hr/status"],
    ["PATCH", "/api/users/me"],
    ["PATCH", "/api/users/me/avatar"],
    ["POST", "/api/uploads"],
    ["POST", "/api/agent/ask"],
  ],
  Overview: [
    ["GET", "/api/vehicles"],
    ["GET", "/api/trips"],
    ["GET", "/api/routes"],
    ["GET", "/api/agent/summary"],
    ["GET", "/api/companies/me/stats/daily"],
    ["GET", "/api/users/drivers"],
    ["GET", "/api/maintenance"],
  ],
  "Live map": [["GET", "/api/tracking/address?lat=-1.28&lng=36.82"]],
  Vehicles: [
    ["GET", "/api/vehicles/veh-a"],
    ["GET", "/api/maintenance?vehicleId=veh-a"],
    ["GET", "/api/trips?vehicleId=veh-a"],
    ["GET", "/api/trips/t1/path"],
    ["GET", "/api/tracking/history?vehicleId=veh-a&from=2026-11-01T00:00:00Z&to=2026-11-02T00:00:00Z"],
  ],
  Drivers: [
    ["GET", "/api/users/drivers/scores?days=30"],
    ["GET", "/api/users/drivers/driver-a"],
    ["GET", "/api/users/drivers/driver-a/score?days=30"],
  ],
  Trips: [
    ["GET", "/api/trips/t1"],
    ["GET", "/api/trips/t1/road"],
  ],
  Expenses: [
    ["GET", "/api/expenses?from=2026-11-01&to=2026-11-30"],
    ["GET", "/api/expenses/export.xlsx"],
    ["POST", "/api/expenses"],
    ["PATCH", "/api/expenses/e1"],
    ["DELETE", "/api/expenses/e1"],
    ["PATCH", "/api/expenses/e1/review"],
  ],
  Reports: [
    ["GET", "/api/reports/summary?from=2026-11-01&to=2026-11-07"],
    ["GET", "/api/reports/summary.xlsx?from=2026-11-01&to=2026-11-07"],
    ["GET", "/api/reports/overview"],
    ...["fuel", "safety", "geofences", "maintenance", "trips"].flatMap((k) => [
      ["GET", `/api/reports/${k}`],
      ["GET", `/api/reports/${k}.xlsx`],
    ]),
  ],
  Billing: [
    ["GET", "/api/companies/me/stats"],
    ["GET", "/api/billing/transactions/mine"],
    ["POST", "/api/billing/checkout"],
    ["GET", "/api/billing/verify/ref-1"],
  ],
  "HR & Payroll": [["POST", "/api/hr/handoff"]],
  "My HR": [
    ["GET", "/api/hr/my/payslips"],
    ["POST", "/api/hr/my/leave/applications"],
  ],
};

let db;
let server;
let baseUrl;
const saved = {};

// Every Prisma model the routes might touch fails at once, except the
// people and memberships the sign-in check needs.
function failingModel(name) {
  return new Proxy({}, { get: (_, op) => async () => { throw new Error(`test: ${name}.${String(op)} not available`); } });
}

before(async () => {
  const companies = [{ id: "co-a", name: "A", status: "active", subscriptionPlan: "pro" }];
  db = {
    companies,
    ...migrateLegacyUsers(
      [
        { id: "acct-a", role: "ACCOUNTANT", companyId: "co-a", fullName: "Alice" },
        { id: "driver-a", role: "DRIVER", companyId: "co-a", fullName: "Dan" },
      ],
      companies
    ),
  };
  const schema = fs.readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  for (const [, model] of schema.matchAll(/^model (\w+) \{/gm)) {
    const key = model[0].toLowerCase() + model.slice(1);
    saved[key] = prisma[key];
    prisma[key] = failingModel(key);
  }
  const m = installMembershipModels(prisma, saved, () => db);
  prisma.user = m.user;

  const app = express();
  app.use(express.json());
  for (const [path, file] of Object.entries(ROUTERS)) app.use(path, (await import(`../routes/${file}.js`)).default);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  Object.assign(prisma, saved);
  await new Promise((resolve) => server.close(resolve));
});

async function call(method, path) {
  const token = jwt.sign({ id: "acct-a", companyId: "co-a", app: "web" }, process.env.JWT_SECRET);
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: method === "GET" ? undefined : "{}",
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // an Excel file, or an empty answer
  }
  return { status: res.status, body };
}

// A refusal because of the role: the staff whitelist (role_forbidden) or a
// route's authorize() list.
const roleRefused = (res) => res.status === 403 && (res.body?.code === "role_forbidden" || /permission/i.test(res.body?.error ?? ""));

for (const [page, calls] of Object.entries(ACCOUNTANT_PAGES)) {
  test(`accountant: ${page} isn't refused`, async () => {
    const refused = [];
    for (const [method, path] of calls) {
      const res = await call(method, path);
      if (process.env.SHOW_STATUS) console.log(res.status, method, path, res.body?.code ?? "");
      // 401 would mean the sign-in itself failed, and prove nothing
      if (res.status === 401 || roleRefused(res)) refused.push(`${method} ${path}: ${res.status} ${res.body?.error}`);
    }
    assert.deepEqual(refused, []);
  });
}

test("the check does catch a refusal (messages aren't an accountant's)", async () => {
  assert.ok(roleRefused(await call("GET", "/api/messages/threads")));
  assert.ok(roleRefused(await call("POST", "/api/vehicles")));
});
