import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { getSummaryReport, downloadSummaryReport } from "../controllers/reportController.js";

const router = express.Router();
router.use(authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"));

router.get("/summary", getSummaryReport);
router.get("/summary.xlsx", downloadSummaryReport);

export default router;
