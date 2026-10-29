import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { getSummaryReport, downloadSummaryReport } from "../controllers/reportController.js";
import { getDetailReport, downloadDetailReport } from "../controllers/reportDetailsController.js";

const router = express.Router();
router.use(authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"));

router.get("/summary", getSummaryReport);
router.get("/summary.xlsx", downloadSummaryReport);

router.get("/overview", getDetailReport("overview"));
for (const kind of ["fuel", "safety", "geofences", "maintenance", "trips"]) {
  router.get(`/${kind}`, getDetailReport(kind));
  router.get(`/${kind}.xlsx`, downloadDetailReport(kind));
}

export default router;
