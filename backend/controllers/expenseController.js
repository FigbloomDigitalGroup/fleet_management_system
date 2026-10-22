import Expense from "../models/Expense.js";
import Vehicle from "../models/Vehicle.js";
import { tenantScope } from "../middleware/auth.js";
import { ownedUploadIds, uploadUrl } from "./uploadController.js";

const CATEGORIES = ["fuel", "toll", "parking", "repair", "other"];

const withReceiptUrl = (e) => ({ ...e.toObject(), receiptUrl: uploadUrl(e.receiptUploadId) });

// DRIVER — log an expense against the vehicle currently assigned to them.
export async function createMyExpense(req, res) {
  try {
    const vehicle = await Vehicle.findOne({ driverId: req.user.id });
    if (!vehicle) return res.status(400).json({ error: "No vehicle is assigned to you yet" });

    const { category, amount, note, incurredAt, receiptUploadId } = req.body;
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(", ")}` });
    }
    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const expense = await Expense.create({
      companyId: vehicle.companyId,
      vehicleId: vehicle._id,
      driverId: req.user.id,
      category,
      amount,
      note: note || null,
      incurredAt: incurredAt ? new Date(incurredAt) : new Date(),
      receiptUploadId: (await ownedUploadIds([receiptUploadId], vehicle.companyId))[0] || null,
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
    const vehicle = await Vehicle.findOne({ driverId: req.user.id });
    if (!vehicle) return res.json([]);

    const expenses = await Expense.find({ vehicleId: vehicle._id }).sort({ incurredAt: -1 }).limit(50);
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
    const expenses = await Expense.find(scope)
      .populate("vehicleId", "plateNumber")
      .populate("driverId", "fullName")
      .sort({ incurredAt: -1 })
      .limit(200);

    const [{ total } = { total: 0 }] = await Expense.aggregate([
      { $match: scope },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    return res.json({ expenses: expenses.map(withReceiptUrl), totalKes: total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch expenses" });
  }
}
