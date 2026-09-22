import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { getBillingOverview, updateCompanyPlan } from "../controllers/billingController.js";

const router = express.Router();
router.use(authenticate, authorize("PLATFORM_ADMIN"));

router.get("/overview", getBillingOverview);
router.patch("/companies/:id/plan", updateCompanyPlan);

export default router;