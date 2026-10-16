import Company from "../models/Company.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Transaction from "../models/Transaction.js";
import { initializeTransaction, verifyTransaction, verifyWebhookSignature } from "../services/paystackService.js";
import { priceForPlan } from "../config/pricing.js";

// PLATFORM_ADMIN only — overview of all companies' subscription plans
export async function getBillingOverview(req, res) {
  try {
    const companies = await Company.find()
      .select("name status subscriptionPlan paymentMethod createdAt")
      .sort({ createdAt: -1 });

    const planCounts = companies.reduce((acc, c) => {
      acc[c.subscriptionPlan] = (acc[c.subscriptionPlan] || 0) + 1;
      return acc;
    }, {});

    return res.json({ companies, planCounts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch billing overview" });
  }
}

// PLATFORM_ADMIN only — manual plan override (comps, sales-assisted
// Enterprise deals, support overrides). Does not touch Transaction/payment
// state — this is a free admin action, not a charge.
export async function updateCompanyPlan(req, res) {
  try {
    const { subscriptionPlan } = req.body;
    const allowed = ["trial", "basic", "pro", "enterprise"];
    if (!allowed.includes(subscriptionPlan)) {
      return res.status(400).json({ error: `subscriptionPlan must be one of: ${allowed.join(", ")}` });
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { subscriptionPlan },
      { new: true }
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update plan" });
  }
}

// PLATFORM_ADMIN only — every real payment across every company, plus the
// actual revenue total (sum of successful charges) as opposed to each
// company's own self-reported totalRevenue figure.
export async function listAllTransactions(req, res) {
  try {
    const transactions = await Transaction.find()
      .populate("companyId", "name")
      .sort({ createdAt: -1 })
      .limit(200);

    const [{ total } = { total: 0 }] = await Transaction.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    return res.json({ transactions, totalRevenueKes: total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
}

// COMPANY_OWNER — starts a real Paystack transaction for an upgrade. The
// amount is computed server-side from the company's own vehicle count, never
// trusted from the client, so there's nothing for a tampered request to exploit.
export async function initializeCheckout(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const { plan } = req.body;
    if (!["basic", "pro"].includes(plan)) {
      return res.status(400).json({ error: "plan must be 'basic' or 'pro'" });
    }

    const [company, owner, vehicleCount] = await Promise.all([
      Company.findById(req.user.companyId),
      User.findById(req.user.id).select("email"),
      Vehicle.countDocuments({ companyId: req.user.companyId }),
    ]);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const amount = priceForPlan(plan) * Math.max(vehicleCount, 1);
    const reference = `fig_${company._id}_${Date.now()}`;

    const transaction = await Transaction.create({
      companyId: company._id,
      plan,
      reference,
      amount,
      currency: "KES",
    });

    const paystackData = await initializeTransaction({
      email: owner.email,
      amount,
      currency: "KES",
      reference,
      channels: ["card", "mobile_money"],
      metadata: { companyId: company._id.toString(), plan, vehicleCount },
    });

    return res.status(201).json({
      reference,
      accessCode: paystackData.access_code,
      authorizationUrl: paystackData.authorization_url,
      amount: transaction.amount,
      currency: transaction.currency,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to start checkout" });
  }
}

// Marks a transaction as succeeded/failed from a Paystack payload — shared
// by the webhook (the authoritative path) and the verify endpoint (a
// same-request fallback for when the browser is still waiting on a result).
// Idempotent: once a transaction is "success" it's never re-applied.
async function applyPaystackResult(transaction, data) {
  if (transaction.status === "success") return transaction;

  if (data.status === "success") {
    transaction.status = "success";
    transaction.channel = data.channel || null;
    transaction.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
    await transaction.save();

    await Company.findByIdAndUpdate(transaction.companyId, {
      subscriptionPlan: transaction.plan,
      paymentMethod: transaction.channel === "mobile_money" ? "mpesa" : "paystack",
    });
  } else if (["failed", "abandoned"].includes(data.status)) {
    transaction.status = data.status;
    await transaction.save();
  }

  return transaction;
}

// COMPANY_OWNER — the frontend calls this right after the Paystack popup
// closes. It does NOT trust the popup's own "it worked" callback — it asks
// Paystack directly whether the charge really succeeded before granting
// anything, same as the webhook does independently.
export async function verifyCheckout(req, res) {
  try {
    const transaction = await Transaction.findOne({
      reference: req.params.reference,
      companyId: req.user.companyId,
    });
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    if (transaction.status !== "success") {
      const data = await verifyTransaction(transaction.reference);
      await applyPaystackResult(transaction, data);
    }

    return res.json({ status: transaction.status, transaction });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to verify payment" });
  }
}

// Paystack calls this directly (no JWT) whenever a transaction's status
// changes — the one path this app actually trusts to grant a plan upgrade,
// since it's signed with the secret key and doesn't depend on the
// customer's browser still being open. req.body is a raw Buffer here (see
// routes/billingRoutes.js), required for signature verification.
export async function paystackWebhook(req, res) {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(req.body.toString("utf8"));

    if (event.event === "charge.success") {
      const transaction = await Transaction.findOne({ reference: event.data.reference });
      if (transaction) {
        await applyPaystackResult(transaction, event.data);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    // Non-2xx tells Paystack to retry the webhook later — appropriate for a
    // genuine transient failure (e.g. a DB hiccup), as opposed to an event
    // we've already handled or don't care about (both return 200 above).
    return res.status(500).json({ error: "Failed to process webhook" });
  }
}

// COMPANY_OWNER — their own payment history
export async function listMyTransactions(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }
    const transactions = await Transaction.find({ companyId: req.user.companyId })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json(transactions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
