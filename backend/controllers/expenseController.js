import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { ownedUploadIds, uploadUrl } from "./uploadController.js";

const CATEGORIES = ["fuel", "toll", "parking", "repair", "other"];

const withReceiptUrl = (e) => ({ ...toApi(e), receiptUrl: uploadUrl(e.receiptUploadId) });

// DRIVER — log an expense against the vehicle currently assigned to them.
export async function createMyExpense(req, res) {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id }, select: { id: true, companyId: true } });
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
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id }, select: { id: true } });
    if (!vehicle) return res.json([]);

    const expenses = await prisma.expense.findMany({ where: { vehicleId: vehicle.id }, orderBy: { incurredAt: "desc" }, take: 50 });
    return res.json(expenses.map(withReceiptUrl));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch your expenses" });
  }
}

// ADMIN/COMPANY_OWNER/PLATFORM_ADMIN — every expense across the company
// (or every company, for PLATFORM_ADMIN), most recent first, plus the real total.
export async function listExpenses(req, res) {
  try {
    const scope = tenantScope(req);
    const expenses = await prisma.expense.findMany({
      where: scope,
      include: {
        vehicle: { select: { id: true, plateNumber: true } },
        driver: { select: { id: true, fullName: true, avatarUploadId: true } },
      },
      orderBy: { incurredAt: "desc" },
      take: 200,
    });

    const total = await prisma.expense.aggregate({ where: scope, _sum: { amount: true } });

    return res.json({ expenses: expenses.map(withReceiptUrl), totalKes: total._sum.amount ?? 0 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch expenses" });
  }
}
