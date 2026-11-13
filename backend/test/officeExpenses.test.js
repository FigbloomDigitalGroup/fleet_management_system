import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

// Office expense management: the owner, full admins and accountants add,
// correct, delete and check expenses; supervisors and dispatcher/viewer
// admins only read; drivers keep their app endpoints (/api/expenses/mine).
// The real routers, middleware and controllers over HTTP, with Prisma's
// models swapped for an in-memory store.

process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test"; // never connected to
delete process.env.HR_INTEGRATION_ENABLED;

const { default: prisma } = await import("../lib/prisma.js");
const { default: expenseRoutes } = await import("../routes/expenseRoutes.js");
const { memoryModel, installMembershipModels, migrateLegacyUsers } = await import("./helpers/memoryModel.js");
const { staffRoleAllows } = await import("../lib/staffRoles.js");

const PEOPLE = [
  { id: "staff", role: "PLATFORM_ADMIN", companyId: null, fullName: "Figbloom Staff" },
  { id: "owner-a", role: "COMPANY_OWNER", companyId: "co-a", fullName: "Mike Owner" },
  { id: "admin-a", role: "ADMIN", adminAccess: "full", companyId: "co-a", fullName: "Full Admin" },
  { id: "disp-a", role: "ADMIN", adminAccess: "dispatcher", companyId: "co-a", fullName: "Dispatcher" },
  { id: "viewer-a", role: "ADMIN", adminAccess: "viewer", companyId: "co-a", fullName: "Viewer" },
  { id: "acct-a", role: "ACCOUNTANT", companyId: "co-a", fullName: "Alice Accountant" },
  { id: "sup-a", role: "SUPERVISOR", companyId: "co-a", fullName: "Sam Supervisor" },
  { id: "op-a", role: "OPERATOR", companyId: "co-a", fullName: "Olga Operator" },
  { id: "mech-a", role: "MECHANIC", companyId: "co-a", fullName: "Moses Mechanic" },
  { id: "driver-a", role: "DRIVER", companyId: "co-a", fullName: "Dan Driver" },
  { id: "driver-a2", role: "DRIVER", companyId: "co-a", fullName: "Dora Driver" },
  { id: "owner-b", role: "COMPANY_OWNER", companyId: "co-b", fullName: "Bea Owner" },
  { id: "driver-b", role: "DRIVER", companyId: "co-b", fullName: "Ben Driver" },
];

const at = (iso) => new Date(iso);
let db;

function reset() {
  const companies = [
    { id: "co-a", name: "Mike's Fleet", status: "active" },
    { id: "co-b", name: "Bea Transport", status: "active" },
  ];
  const { users, memberships } = migrateLegacyUsers(PEOPLE, companies);
  const expense = (row) => ({
    driverId: null,
    note: null,
    receiptUploadId: null,
    source: "driver_app",
    createdById: null,
    reviewedAt: null,
    reviewedById: null,
    reviewNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...row,
  });
  db = {
    users,
    memberships,
    companies,
    vehicles: [
      { id: "veh-a", companyId: "co-a", plateNumber: "KAA 001A", driverId: "driver-a" },
      { id: "veh-a2", companyId: "co-a", plateNumber: "KAA 002A", driverId: null },
      { id: "veh-b", companyId: "co-b", plateNumber: "KBB 001B", driverId: "driver-b" },
    ],
    uploads: [
      { id: "up-a", companyId: "co-a", kind: "receipt" },
      { id: "up-b", companyId: "co-b", kind: "receipt" },
    ],
    expenses: [
      expense({ id: "exp-fuel", companyId: "co-a", vehicleId: "veh-a", driverId: "driver-a", category: "fuel", amount: 5000, incurredAt: at("2026-11-01T08:00:00Z") }),
      expense({
        id: "exp-toll",
        companyId: "co-a",
        vehicleId: "veh-a",
        driverId: "driver-a",
        category: "toll",
        amount: 200,
        incurredAt: at("2026-11-05T08:00:00Z"),
        reviewedAt: at("2026-11-06T08:00:00Z"),
        reviewedById: "acct-a",
      }),
      expense({ id: "exp-repair", companyId: "co-a", vehicleId: "veh-a2", category: "repair", amount: 12000, incurredAt: at("2026-10-20T08:00:00Z"), source: "office", createdById: "owner-a" }),
      expense({ id: "exp-b", companyId: "co-b", vehicleId: "veh-b", driverId: "driver-b", category: "fuel", amount: 999, incurredAt: at("2026-11-02T08:00:00Z") }),
    ],
  };
}

let server;
let baseUrl;
const saved = {};

before(async () => {
  for (const key of ["user", "company", "vehicle", "expense", "upload"]) saved[key] = prisma[key];
  const m = installMembershipModels(prisma, saved, () => db);
  prisma.user = m.user;
  prisma.company = m.company;
  const vehicle = memoryModel(() => db.vehicles, { prefix: "veh" });
  prisma.vehicle = vehicle;
  prisma.upload = memoryModel(() => db.uploads, { prefix: "upload" });
  prisma.expense = memoryModel(() => db.expenses, {
    prefix: "exp",
    relations: {
      vehicle: { rows: () => db.vehicles, from: "vehicleId", to: "id", model: () => vehicle },
      driver: { rows: () => db.users, from: "driverId", to: "id", model: () => m.user },
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/api/expenses", expenseRoutes);
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
  const person = PEOPLE.find((p) => p.id === userId);
  const token = jwt.sign({ id: userId, companyId: person.companyId, app: person.role === "DRIVER" ? "mobile" : "web" }, process.env.JWT_SECRET);
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get("content-type") || "";
  if (!type.includes("json")) return { status: res.status, headers: res.headers, raw: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const newExpense = (extra = {}) => ({ vehicleId: "veh-a2", category: "parking", amount: 300, note: "Town parking", ...extra });
const row = (id) => db.expenses.find((e) => e.id === id);

// ---- adding

test("an accountant adds an office expense; it records who entered it", async () => {
  const res = await call("acct-a", "POST", "/api/expenses", newExpense({ receiptUploadId: "up-a", driverId: "driver-a2", incurredAt: "2026-11-10T09:00:00Z" }));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.amount, 300);
  assert.equal(res.body.fromDriverApp, false);
  assert.deepEqual(res.body.enteredBy, { id: "acct-a", fullName: "Alice Accountant" });
  assert.equal(res.body.vehicleId.plateNumber, "KAA 002A");
  assert.equal(res.body.driverId.fullName, "Dora Driver");
  assert.ok(res.body.receiptUrl);
  const saved = row(res.body._id);
  assert.equal(saved.companyId, "co-a");
  assert.equal(saved.source, "office");
  assert.equal(saved.createdById, "acct-a");
  assert.equal(saved.incurredAt.toISOString(), "2026-11-10T09:00:00.000Z");
});

test("the owner and a full admin add expenses; the date defaults to now", async () => {
  const before = Date.now();
  for (const who of ["owner-a", "admin-a"]) {
    const res = await call(who, "POST", "/api/expenses", newExpense({ amount: "1,250.5" }));
    assert.equal(res.status, 201, `${who}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.amount, 1250.5);
    assert.ok(new Date(res.body.incurredAt).getTime() >= before - 1000);
    assert.equal(res.body.driverId, null);
  }
});

test("adding checks every field and keeps it to the company", async () => {
  const bad = [
    [{ vehicleId: undefined }, /Pick the vehicle/],
    [{ vehicleId: "veh-b" }, /isn't in your fleet/],
    [{ vehicleId: "nope" }, /isn't in your fleet/],
    [{ category: "lunch" }, /type of expense/],
    [{ amount: 0 }, /above 0/],
    [{ amount: -5 }, /above 0/],
    [{ amount: "abc" }, /above 0/],
    [{ amount: undefined }, /above 0/],
    [{ incurredAt: new Date(Date.now() + 86400000).toISOString() }, /future/],
    [{ incurredAt: "not a date" }, /valid date/],
    [{ receiptUploadId: "up-b" }, /receipt photo wasn't found/],
    [{ driverId: "driver-b" }, /driver isn't in your fleet/],
    [{ driverId: "acct-a" }, /driver isn't in your fleet/],
  ];
  for (const [change, message] of bad) {
    const res = await call("acct-a", "POST", "/api/expenses", newExpense(change));
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.match(res.body.error, message, JSON.stringify(change));
  }
  assert.equal(db.expenses.length, 4, "nothing saved");
});

// ---- editing and deleting

test("an accountant corrects an expense, including a driver's", async () => {
  const res = await call("acct-a", "PATCH", "/api/expenses/exp-fuel", { amount: 5200, note: "Receipt said 5,200", category: "fuel" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(row("exp-fuel").amount, 5200);
  assert.equal(row("exp-fuel").note, "Receipt said 5,200");
  // unsent fields stay as they were
  assert.equal(row("exp-fuel").vehicleId, "veh-a");
  assert.equal(row("exp-fuel").driverId, "driver-a");
  assert.equal(row("exp-fuel").source, "driver_app");

  const moved = await call("acct-a", "PATCH", "/api/expenses/exp-repair", { vehicleId: "veh-a", driverId: null, receiptUploadId: "up-a" });
  assert.equal(moved.status, 200);
  assert.equal(row("exp-repair").vehicleId, "veh-a");
  assert.equal(row("exp-repair").receiptUploadId, "up-a");

  assert.equal((await call("acct-a", "PATCH", "/api/expenses/exp-repair", { vehicleId: "veh-b" })).status, 400);
  assert.equal((await call("acct-a", "PATCH", "/api/expenses/exp-repair", { amount: 0 })).status, 400);
  assert.equal((await call("acct-a", "PATCH", "/api/expenses/exp-repair", { receiptUploadId: "up-b" })).status, 400);
  assert.equal(row("exp-repair").vehicleId, "veh-a");
});

test("an accountant deletes an expense", async () => {
  const res = await call("acct-a", "DELETE", "/api/expenses/exp-repair");
  assert.equal(res.status, 200);
  assert.equal(row("exp-repair"), undefined);
  assert.equal((await call("acct-a", "DELETE", "/api/expenses/exp-repair")).status, 404);
});

test("another company's expense is not found: edit, delete and check are 404", async () => {
  for (const who of ["acct-a", "owner-a", "admin-a"]) {
    assert.equal((await call(who, "PATCH", "/api/expenses/exp-b", { amount: 1 })).status, 404);
    assert.equal((await call(who, "DELETE", "/api/expenses/exp-b")).status, 404);
    assert.equal((await call(who, "PATCH", "/api/expenses/exp-b/review", { checked: true })).status, 404);
  }
  assert.equal(row("exp-b").amount, 999);
  assert.equal(row("exp-b").reviewedAt, null);
  // and the other way round
  assert.equal((await call("owner-b", "DELETE", "/api/expenses/exp-fuel")).status, 404);
  assert.ok(row("exp-fuel"));
});

// ---- checking drivers' expenses

test("the office marks a driver's expense as checked, and can undo it", async () => {
  const res = await call("acct-a", "PATCH", "/api/expenses/exp-fuel/review", { checked: true, note: "Matches the M-Pesa statement" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.reviewedAt);
  assert.deepEqual(res.body.checkedBy, { id: "acct-a", fullName: "Alice Accountant" });
  assert.equal(row("exp-fuel").reviewedById, "acct-a");
  assert.equal(row("exp-fuel").reviewNote, "Matches the M-Pesa statement");

  // checking again keeps the first check
  const first = row("exp-fuel").reviewedAt;
  assert.equal((await call("owner-a", "PATCH", "/api/expenses/exp-fuel/review", { checked: true })).status, 200);
  assert.equal(row("exp-fuel").reviewedAt, first);
  assert.equal(row("exp-fuel").reviewedById, "acct-a");

  const undo = await call("owner-a", "PATCH", "/api/expenses/exp-fuel/review", { checked: false });
  assert.equal(undo.status, 200);
  assert.equal(undo.body.reviewedAt, null);
  assert.equal(undo.body.checkedBy, null);
  assert.equal(row("exp-fuel").reviewNote, null);
});

test("an office expense doesn't need checking", async () => {
  const res = await call("acct-a", "PATCH", "/api/expenses/exp-repair/review", { checked: true });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "not_driver_expense");
  assert.equal((await call("acct-a", "PATCH", "/api/expenses/exp-fuel/review", { checked: "yes" })).status, 400);
});

// ---- who may do what

test("supervisors, operators, mechanics, dispatcher and viewer admins can't change expenses", async () => {
  for (const who of ["sup-a", "op-a", "mech-a", "disp-a", "viewer-a", "driver-a"]) {
    for (const [method, path, body] of [
      ["POST", "/api/expenses", newExpense()],
      ["PATCH", "/api/expenses/exp-fuel", { amount: 1 }],
      ["DELETE", "/api/expenses/exp-fuel"],
      ["PATCH", "/api/expenses/exp-fuel/review", { checked: true }],
    ]) {
      const res = await call(who, method, path, body);
      assert.equal(res.status, 403, `${who} ${method} ${path}`);
    }
  }
  assert.equal(db.expenses.length, 4);
  assert.equal(row("exp-fuel").amount, 5000);
  assert.equal(row("exp-fuel").reviewedAt, null);
});

test("Figbloom staff read every fleet's expenses but don't enter any", async () => {
  const list = await call("staff", "GET", "/api/expenses");
  assert.equal(list.status, 200);
  assert.equal(list.body.count, 4);
  assert.equal((await call("staff", "POST", "/api/expenses", newExpense())).status, 403);
});

test("who reads the list: the office yes, operators, mechanics and drivers no", async () => {
  for (const who of ["owner-a", "admin-a", "disp-a", "viewer-a", "acct-a", "sup-a"]) {
    const res = await call(who, "GET", "/api/expenses");
    assert.equal(res.status, 200, who);
    assert.equal(res.body.count, 3, who);
  }
  for (const who of ["op-a", "mech-a", "driver-a"]) assert.equal((await call(who, "GET", "/api/expenses")).status, 403, who);
});

test("drivers keep logging and reading their own from the app", async () => {
  const logged = await call("driver-a", "POST", "/api/expenses/mine", { category: "fuel", amount: 3000, receiptUploadId: "up-a" });
  assert.equal(logged.status, 201, JSON.stringify(logged.body));
  const saved = row(logged.body._id);
  assert.equal(saved.vehicleId, "veh-a");
  assert.equal(saved.driverId, "driver-a");
  assert.equal(saved.source ?? "driver_app", "driver_app", "the database default: from the app");
  const mine = await call("driver-a", "GET", "/api/expenses/mine");
  assert.equal(mine.status, 200);
  assert.equal(mine.body.length, 3);
  // the office's endpoints aren't for drivers, and /mine isn't for the office
  assert.equal((await call("acct-a", "POST", "/api/expenses/mine", { category: "fuel", amount: 1 })).status, 403);
});

test("the staff whitelist: accountants write expenses, supervisors only read", () => {
  const can = staffRoleAllows;
  assert.ok(can("ACCOUNTANT", "POST", "/api/expenses"));
  assert.ok(can("ACCOUNTANT", "PATCH", "/api/expenses/e1"));
  assert.ok(can("ACCOUNTANT", "DELETE", "/api/expenses/e1"));
  assert.ok(can("ACCOUNTANT", "PATCH", "/api/expenses/e1/review"));
  assert.ok(can("ACCOUNTANT", "GET", "/api/expenses/export.xlsx"));
  assert.ok(!can("ACCOUNTANT", "POST", "/api/expenses/mine"));
  assert.ok(!can("ACCOUNTANT", "PATCH", "/api/expenses/mine"));
  assert.ok(!can("ACCOUNTANT", "DELETE", "/api/expenses/e1/review"));
  assert.ok(!can("ACCOUNTANT", "PUT", "/api/expenses/e1"));
  for (const role of ["SUPERVISOR", "OPERATOR", "MECHANIC"]) {
    assert.ok(!can(role, "POST", "/api/expenses"), role);
    assert.ok(!can(role, "PATCH", "/api/expenses/e1"), role);
    assert.ok(!can(role, "DELETE", "/api/expenses/e1"), role);
    assert.ok(!can(role, "PATCH", "/api/expenses/e1/review"), role);
  }
  assert.ok(can("SUPERVISOR", "GET", "/api/expenses/export.xlsx"));
});

// ---- filters, totals, export

test("filters narrow the list and the totals follow them", async () => {
  const get = async (q) => (await call("acct-a", "GET", `/api/expenses${q}`)).body;

  const all = await get("");
  assert.equal(all.count, 3);
  assert.equal(all.totalKes, 17200);
  assert.deepEqual(all.byCategory, { fuel: 5000, toll: 200, parking: 0, repair: 12000, other: 0 });
  assert.equal(all.needsChecking, 1);
  assert.deepEqual(all.expenses.map((e) => e._id), ["exp-toll", "exp-fuel", "exp-repair"], "newest first");
  const fuel = all.expenses.find((e) => e._id === "exp-fuel");
  assert.equal(fuel.fromDriverApp, true);
  assert.equal(fuel.enteredBy, null);
  assert.equal(all.expenses.find((e) => e._id === "exp-toll").checkedBy.fullName, "Alice Accountant");
  assert.equal(all.expenses.find((e) => e._id === "exp-repair").enteredBy.fullName, "Mike Owner");

  const november = await get("?from=2026-11-01&to=2026-11-30");
  assert.deepEqual(november.expenses.map((e) => e._id), ["exp-toll", "exp-fuel"]);
  assert.equal(november.totalKes, 5200);
  assert.equal(november.needsChecking, 1, "the reminder counts the whole fleet");

  // a day is a Nairobi day: 2026-11-01 08:00Z is 11:00 in Nairobi
  assert.equal((await get("?from=2026-11-01&to=2026-11-01")).totalKes, 5000);
  assert.equal((await get("?to=2026-10-31")).totalKes, 12000);

  assert.equal((await get("?vehicleId=veh-a2")).totalKes, 12000);
  assert.equal((await get("?vehicleId=veh-b")).count, 0, "another company's vehicle finds nothing");
  assert.equal((await get("?driverId=driver-a")).totalKes, 5200);
  assert.equal((await get("?category=toll")).totalKes, 200);
  const unchecked = await get("?checked=no");
  assert.deepEqual(unchecked.expenses.map((e) => e._id), ["exp-fuel"]);
  assert.equal(unchecked.totalKes, 5000);
  assert.deepEqual((await get("?checked=yes")).expenses.map((e) => e._id), ["exp-toll"]);
  assert.equal((await get("?category=fuel&checked=yes")).count, 0);

  for (const q of ["?category=lunch", "?checked=maybe", "?from=garbage", "?from=2026-11-10&to=2026-11-01"]) {
    assert.equal((await call("acct-a", "GET", `/api/expenses${q}`)).status, 400, q);
  }
});

test("the Excel export has the filtered rows and a total", async () => {
  const res = await call("acct-a", "GET", "/api/expenses/export.xlsx?from=2026-11-01&to=2026-11-30");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /spreadsheetml/);
  assert.match(res.headers.get("content-disposition"), /fleet-expenses-2026-11-01-to-2026-11-30\.xlsx/);
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(res.raw);
  const sheet = book.getWorksheet("Expenses");
  const values = sheet.getSheetValues().filter(Boolean).map((r) => r.slice(1));
  assert.deepEqual(values[0], ["Date", "Vehicle", "Driver", "Type", "Amount (KES)", "Note", "Entered by", "Checked"]);
  assert.equal(values.length, 4, "header, two rows, total");
  assert.deepEqual(values[1].slice(0, 5), ["2026-11-05", "KAA 001A", "Dan Driver", "Toll", 200]);
  assert.equal(values[1][7], "Yes, 2026-11-06");
  assert.equal(values[2][7], "Not yet");
  assert.equal(values[3][0], "Total");
  assert.equal(values[3][4], 5200);

  assert.equal((await call("sup-a", "GET", "/api/expenses/export.xlsx")).status, 200, "readers may export");
  assert.equal((await call("op-a", "GET", "/api/expenses/export.xlsx")).status, 403);
});
