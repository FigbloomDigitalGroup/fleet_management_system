import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { initializeTransaction, verifyTransaction, verifyWebhookSignature } from "../services/paystackService.js";
import { priceForPlan } from "../config/pricing.js";

// PLATFORM_ADMIN only — overview of all companies' subscription plans
export async function getBillingOverview(req, res) {
  try {
    const companies = await prisma.company.findMany({
      select: { id: true, name: true, status: true, subscriptionPlan: true, paymentMethod: true, createdAt: true, logoUploadId: true },
      orderBy: { createdAt: "desc" },
    });

    const planCounts = companies.reduce((acc, c) => {
      acc[c.subscriptionPlan] = (acc[c.subscriptionPlan] || 0) + 1;
      return acc;
    }, {});

    return res.json({ companies: toApi(companies), planCounts });
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

    const { count } = await prisma.company.updateMany({ where: { id: req.params.id }, data: { subscriptionPlan } });
    if (!count) return res.status(404).json({ error: "Company not found" });

    return res.json(toApi(await prisma.company.findUnique({ where: { id: req.params.id } })));
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
    const transactions = await prisma.transaction.findMany({
      include: { company: { select: { id: true, name: true, logoUploadId: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const total = await prisma.transaction.aggregate({ where: { status: "success" }, _sum: { amount: true } });

    return res.json({ transactions: toApi(transactions), totalRevenueKes: total._sum.amount ?? 0 });
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
      prisma.company.findUnique({ where: { id: req.user.companyId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } }),
      prisma.vehicle.count({ where: { companyId: req.user.companyId } }),
    ]);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const amount = priceForPlan(plan) * Math.max(vehicleCount, 1);
    const reference = `fig_${company.id}_${Date.now()}`;

    const transaction = await prisma.transaction.create({
      data: { companyId: company.id, plan, reference, amount, currency: "KES" },
    });

    const paystackData = await initializeTransaction({
      email: owner.email,
      amount,
      currency: "KES",
      reference,
      channels: ["card", "mobile_money"],
      metadata: { companyId: company.id, plan, vehicleCount },
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
// Idempotent: once a transaction is "success" it's never re-applied — the
// status check is part of the update, so the webhook and the verify call
// arriving together can't both apply it. Returns the transaction as stored.
async function applyPaystackResult(transaction, data) {
  if (transaction.status === "success") return transaction;

  if (data.status === "success") {
    const channel = data.channel || null;
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.transaction.updateMany({
        where: { id: transaction.id, status: { not: "success" } },
        data: { status: "success", channel, paidAt: data.paid_at ? new Date(data.paid_at) : new Date() },
      });
      if (!count) return;
      await tx.company.update({
        where: { id: transaction.companyId },
        data: { subscriptionPlan: transaction.plan, paymentMethod: channel === "mobile_money" ? "mpesa" : "paystack" },
      });
    });
  } else if (["failed", "abandoned"].includes(data.status)) {
    await prisma.transaction.updateMany({
      where: { id: transaction.id, status: { not: "success" } },
      data: { status: data.status },
    });
  }

  return prisma.transaction.findUnique({ where: { id: transaction.id } });
}

// COMPANY_OWNER — the frontend calls this right after the Paystack popup
// closes. It does NOT trust the popup's own "it worked" callback — it asks
// Paystack directly whether the charge really succeeded before granting
// anything, same as the webhook does independently.
export async function verifyCheckout(req, res) {
  try {
    let transaction = await prisma.transaction.findFirst({
      where: { reference: req.params.reference, companyId: req.user.companyId ?? "" },
    });
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    if (transaction.status !== "success") {
      const data = await verifyTransaction(transaction.reference);
      transaction = await applyPaystackResult(transaction, data);
    }

    return res.json({ status: transaction.status, transaction: toApi(transaction) });
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
      const transaction = await prisma.transaction.findUnique({ where: { reference: String(event.data.reference) } });
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
    const transactions = await prisma.transaction.findMany({
      where: { companyId: req.user.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json(toApi(transactions));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
