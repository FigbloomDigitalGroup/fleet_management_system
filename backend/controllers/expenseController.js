import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { ownedUploadIds, uploadUrl } from "./uploadController.js";
import { dateKey } from "./reportController.js";
import { sendSheetDownload } from "../lib/excelDownload.js";

const CATEGORIES = ["fuel", "toll", "parking", "repair", "other"];

const withReceiptUrl = (e) => ({ ...toApi(e), receiptUrl: uploadUrl(e.receiptUploadId) });

// DRIVER — log an expense against the vehicle currently assigned to them.
export async function createMyExpense(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id, companyId: req.user.companyId }, select: { id: true, companyId: true } });
    if (!vehicle) return res.status(400).json({ error: "No vehicle is assigned to you yet" });

    const { category, amount, note, incurredAt, receiptUploadId } = req.body;
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(", ")}` });
    }
    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const when = incurredAt ? new Date(incurredAt) : new Date();
    if (Number.isNaN(when.getTime())) return res.status(400).json({ error: "incurredAt must be a valid date" });
    const expense = await prisma.expense.create({
      data: {
        companyId: vehicle.companyId,
        vehicleId: vehicle.id,
        driverId: req.user.id,
        category,
        amount,
        note: note ? String(note) : null,
        incurredAt: when,
        receiptUploadId: (await ownedUploadIds([receiptUploadId], vehicle.companyId))[0] || null,
      },
    });

    return res.status(201).json(withReceiptUrl(expense));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to log expense" });
  }
}

// DRIVER — their own expense history
export async function listMyExpenses(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id, companyId: req.user.companyId }, select: { id: true } });
    if (!vehicle) return res.json([]);

    const expenses = await prisma.expense.findMany({ where: { vehicleId: vehicle.id }, orderBy: { incurredAt: "desc" }, take: 50 });
    return res.json(expenses.map(withReceiptUrl));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your expenses" });
  }
}

// ---- The office. Owner, full admins and accountants add, correct, delete
// and check expenses; supervisors and dispatcher/viewer admins only read
// (routes/expenseRoutes.js, lib/staffRoles.js, middleware/auth.js).

const CATEGORY_LABELS = { fuel: "Fuel", toll: "Toll", parking: "Parking", repair: "Repair", other: "Other" };
const LIST_LIMIT = 500;
const EXPORT_LIMIT = 10000;
const NOTE_MAX = 1000;
const REVIEW_NOTE_MAX = 500;
const MAX_AMOUNT = 100_000_000;
// A computer clock a little ahead isn't "the future".
const FUTURE_SLACK_MS = 5 * 60 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Days are Nairobi days; Kenya is UTC+3 all year (no daylight saving).
const dayStart = (d) => new Date(`${d}T00:00:00.000+03:00`);
const dayEnd = (d) => new Date(`${d}T23:59:59.999+03:00`);

const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
const blankToNull = (v) => (v === null || (typeof v === "string" && !v.trim()) ? null : v);

// Checks an office expense's fields (all of them when creating, only the
// ones sent when editing) -> { data } or { error }. The vehicle, driver and
// receipt must all belong to the company.
async function readExpenseInput(rawBody, companyId, { creating }) {
  const body = rawBody && typeof rawBody === "object" ? rawBody : {};
  const data = {};

  if (creating || has(body, "vehicleId")) {
    const vehicleId = blankToNull(body.vehicleId);
    if (!vehicleId) return { error: "Pick the vehicle this expense is for" };
    const vehicle = await prisma.vehicle.findFirst({ where: { id: String(vehicleId), companyId }, select: { id: true } });
    if (!vehicle) return { error: "That vehicle isn't in your fleet" };
    data.vehicleId = vehicle.id;
  }

  if (creating || has(body, "category")) {
    if (!CATEGORIES.includes(body.category)) return { error: `Pick a type of expense: ${CATEGORIES.join(", ")}` };
    data.category = body.category;
  }

  if (creating || has(body, "amount")) {
    const raw = typeof body.amount === "string" && body.amount.trim() ? Number(body.amount.replace(/,/g, "")) : body.amount;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return { error: "Enter an amount in KES above 0" };
    if (raw > MAX_AMOUNT) return { error: "That amount looks too large. Check it and try again" };
    data.amount = Math.round(raw * 100) / 100;
  }

  if (has(body, "incurredAt") && blankToNull(body.incurredAt) !== null) {
    const when = new Date(body.incurredAt);
    if (Number.isNaN(when.getTime())) return { error: "Enter a valid date" };
    if (when.getTime() > Date.now() + FUTURE_SLACK_MS) return { error: "The date can't be in the future" };
    data.incurredAt = when;
  } else if (creating) {
    data.incurredAt = new Date();
  }

  if (creating || has(body, "note")) {
    const note = blankToNull(body.note);
    data.note = note === null || note === undefined ? null : String(note).trim().slice(0, NOTE_MAX);
  }

  if (has(body, "receiptUploadId")) {
    const id = blankToNull(body.receiptUploadId);
    if (id === null) data.receiptUploadId = null;
    else {
      const [owned] = await ownedUploadIds([String(id)], companyId);
      if (!owned) return { error: "That receipt photo wasn't found. Please upload it again" };
      data.receiptUploadId = owned;
    }
  } else if (creating) data.receiptUploadId = null;

  if (has(body, "driverId")) {
    const id = blankToNull(body.driverId);
    if (id === null) data.driverId = null;
    else {
      const member = await prisma.membership.findFirst({ where: { userId: String(id), companyId, role: "DRIVER" }, select: { userId: true } });
      if (!member) return { error: "That driver isn't in your fleet" };
      data.driverId = member.userId;
    }
  } else if (creating) data.driverId = null;

  return { data };
}

// The list's filters (?from=&to=&vehicleId=&driverId=&category=&checked=)
// -> { where } or { error }. from/to are days (YYYY-MM-DD, Nairobi) or full
// timestamps; checked=no is a driver's expense nobody has checked yet.
export function expenseFilters(req) {
  const q = req.query ?? {};
  const where = { ...tenantScope(req) };
  const incurredAt = {};
  for (const [key, toDate, op] of [["from", dayStart, "gte"], ["to", dayEnd, "lte"]]) {
    const v = typeof q[key] === "string" ? q[key].trim() : "";
    if (!v) continue;
    const when = DAY.test(v) ? toDate(v) : new Date(v);
    if (Number.isNaN(when.getTime())) return { error: `"${key}" must be a date` };
    incurredAt[op] = when;
  }
  if (incurredAt.gte && incurredAt.lte && incurredAt.gte > incurredAt.lte) return { error: "The start date must be before the end date" };
  if (incurredAt.gte || incurredAt.lte) where.incurredAt = incurredAt;
  if (q.vehicleId) where.vehicleId = String(q.vehicleId);
  if (q.driverId) where.driverId = String(q.driverId);
  if (q.category) {
    if (!CATEGORIES.includes(q.category)) return { error: `category must be one of: ${CATEGORIES.join(", ")}` };
    where.category = q.category;
  }
  if (q.checked === "yes") where.reviewedAt = { not: null };
  else if (q.checked === "no") Object.assign(where, { source: "driver_app", reviewedAt: null });
  else if (q.checked) return { error: "checked must be yes or no" };
  return { where };
}

const EXPENSE_INCLUDE = {
  vehicle: { select: { id: true, plateNumber: true } },
  driver: { select: { id: true, fullName: true, avatarUploadId: true } },
};

// Names of the people who entered or checked these expenses.
async function peopleNames(rows) {
  const ids = [...new Set(rows.flatMap((e) => [e.createdById, e.reviewedById]).filter(Boolean))];
  if (!ids.length) return new Map();
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
  return new Map(people.map((p) => [p.id, p.fullName]));
}

const person = (id, names) => (id ? { id, fullName: names.get(id) ?? "A former team member" } : null);

function present(e, names) {
  return {
    ...withReceiptUrl(e),
    fromDriverApp: e.source === "driver_app",
    enteredBy: person(e.createdById, names),
    checkedBy: person(e.reviewedById, names),
  };
}

const presentOne = async (e) => present(e, await peopleNames([e]));

// Scoped to the session's company: another company's expense is "not found".
const findOwnExpense = (req) =>
  prisma.expense.findFirst({ where: { id: String(req.params.id), companyId: req.user.companyId }, include: EXPENSE_INCLUDE });

// GET /api/expenses — the company's expenses (every company's for
// PLATFORM_ADMIN), newest first, totals that follow the filters, and how
// many drivers' expenses still need checking.
export async function listExpenses(req, res) {
  try {
    const filters = expenseFilters(req);
    if (filters.error) return res.status(400).json({ error: filters.error });
    const { where } = filters;
    const [expenses, total, perCategory, needsChecking] = await Promise.all([
      prisma.expense.findMany({ where, include: EXPENSE_INCLUDE, orderBy: { incurredAt: "desc" }, take: LIST_LIMIT }),
      prisma.expense.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
      prisma.expense.groupBy({ by: ["category"], where, _sum: { amount: true } }),
      prisma.expense.count({ where: { ...tenantScope(req), source: "driver_app", reviewedAt: null } }),
    ]);
    const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    for (const g of perCategory) byCategory[g.category] = g._sum?.amount ?? 0;
    const names = await peopleNames(expenses);

    return res.json({
      expenses: expenses.map((e) => present(e, names)),
      totalKes: total._sum.amount ?? 0,
      count: total._count?._all ?? expenses.length,
      byCategory,
      needsChecking,
      limit: LIST_LIMIT,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch expenses" });
  }
}

// GET /api/expenses/export.xlsx — the filtered list as Excel, with a total.
export async function exportExpenses(req, res) {
  try {
    const filters = expenseFilters(req);
    if (filters.error) return res.status(400).json({ error: filters.error });
    const { where } = filters;
    const expenses = await prisma.expense.findMany({ where, include: EXPENSE_INCLUDE, orderBy: { incurredAt: "desc" }, take: EXPORT_LIMIT });
    const names = await peopleNames(expenses);
    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const day = (d) => dateKey(new Date(d));
    const sheet = {
      title: "Expenses",
      columns: [
        ["Date", "date", 12],
        ["Vehicle", "vehicle", 14],
        ["Driver", "driver", 22],
        ["Type", "category", 10],
        ["Amount (KES)", "amount", 14],
        ["Note", "note", 36],
        ["Entered by", "enteredBy", 22],
        ["Checked", "checked", 20],
      ],
      rows: expenses.map((e) => ({
        date: day(e.incurredAt),
        vehicle: e.vehicle?.plateNumber ?? "",
        driver: e.driver?.fullName ?? "",
        category: CATEGORY_LABELS[e.category] ?? e.category,
        amount: e.amount,
        note: e.note ?? "",
        enteredBy: e.source === "driver_app" ? "Driver (app)" : person(e.createdById, names)?.fullName ?? "Office",
        checked: e.source !== "driver_app" ? "Entered by the office" : e.reviewedAt ? `Yes, ${day(e.reviewedAt)}` : "Not yet",
      })),
      total: { date: "Total", amount: Math.round(total * 100) / 100 },
    };
    const from = where.incurredAt?.gte ? day(where.incurredAt.gte) : "start";
    const to = day(where.incurredAt?.lte ?? new Date());
    await sendSheetDownload(res, sheet, `fleet-expenses-${from}-to-${to}.xlsx`);
  } catch (err) {
    console.error("[expenses.xlsx]", err);
    if (!res.headersSent) return res.status(500).json({ error: "Failed to build the expenses file" });
  }
}

// POST /api/expenses — an expense entered in the office.
export async function createExpense(req, res) {
  try {
    const input = await readExpenseInput(req.body, req.user.companyId, { creating: true });
    if (input.error) return res.status(400).json({ error: input.error });
    const expense = await prisma.expense.create({
      data: { ...input.data, companyId: req.user.companyId, source: "office", createdById: req.user.id },
      include: EXPENSE_INCLUDE,
    });
    return res.status(201).json(await presentOne(expense));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save the expense" });
  }
}

// PATCH /api/expenses/:id — correct any of the company's expenses.
export async function updateExpense(req, res) {
  try {
    const existing = await findOwnExpense(req);
    if (!existing) return res.status(404).json({ error: "Expense not found" });
    const input = await readExpenseInput(req.body, req.user.companyId, { creating: false });
    if (input.error) return res.status(400).json({ error: input.error });
    const expense = await prisma.expense.update({ where: { id: existing.id }, data: input.data, include: EXPENSE_INCLUDE });
    return res.json(await presentOne(expense));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save the expense" });
  }
}

// DELETE /api/expenses/:id
export async function deleteExpense(req, res) {
  try {
    const existing = await findOwnExpense(req);
    if (!existing) return res.status(404).json({ error: "Expense not found" });
    await prisma.expense.delete({ where: { id: existing.id } });
    return res.json({ message: "Expense deleted." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete the expense" });
  }
}

// PATCH /api/expenses/:id/review — { checked: true | false, note? }: mark a
// driver's expense as checked by the office, or undo that.
export async function reviewExpense(req, res) {
  try {
    const existing = await findOwnExpense(req);
    if (!existing) return res.status(404).json({ error: "Expense not found" });
    if (existing.source !== "driver_app") {
      return res.status(400).json({ error: "Only expenses drivers logged from the app need checking", code: "not_driver_expense" });
    }
    if (req.body?.checked !== undefined && typeof req.body.checked !== "boolean") {
      return res.status(400).json({ error: "checked must be true or false" });
    }
    const checked = req.body?.checked !== false;
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, REVIEW_NOTE_MAX) || null : null;
    const data = checked
      ? { reviewedAt: existing.reviewedAt ?? new Date(), reviewedById: existing.reviewedById ?? req.user.id, reviewNote: note ?? existing.reviewNote ?? null }
      : { reviewedAt: null, reviewedById: null, reviewNote: null };
    const expense = await prisma.expense.update({ where: { id: existing.id }, data, include: EXPENSE_INCLUDE });
    return res.json(await presentOne(expense));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save the check" });
  }
}
