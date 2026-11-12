import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getBillingOverview,
  updateCompanyPlan,
  listAllTransactions,
  initializeCheckout,
  verifyCheckout,
  paystackWebhook,
  listMyTransactions,
} from "../controllers/billingController.js";

const router = express.Router();

// Paystack calls this directly — no JWT, verified via HMAC signature instead
// (see paystackService.verifyWebhookSignature). It needs the raw request
// body for that, so it gets its own express.raw() parser; Index.js makes
// sure the app-wide express.json() skips this one path so the body arrives
// here as an untouched Buffer.
router.post("/webhook", express.raw({ type: "application/json" }), paystackWebhook);

router.use(authenticate);

router.get("/overview", authorize("PLATFORM_ADMIN"), getBillingOverview);
router.patch("/companies/:id/plan", authorize("PLATFORM_ADMIN"), updateCompanyPlan);
router.get("/transactions", authorize("PLATFORM_ADMIN"), listAllTransactions);

// The company's accountant pays the plan too (lib/staffRoles.js).
router.post("/checkout", authorize("COMPANY_OWNER", "ACCOUNTANT"), initializeCheckout);
router.get("/verify/:reference", authorize("COMPANY_OWNER", "ACCOUNTANT"), verifyCheckout);
router.get("/transactions/mine", authorize("COMPANY_OWNER", "ACCOUNTANT"), listMyTransactions);

export default router;
