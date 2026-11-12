import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { startSupportView, endSupportView, listStaffAudit, createFleet } from "../controllers/staffController.js";

// Figbloom staff only. A support-view token runs as COMPANY_OWNER, so it can
// never reach these (authorize refuses it): starting or ending a support view
// and creating fleets always need the staff member's own sign-in.
const router = express.Router();
router.use(authenticate, authorize("PLATFORM_ADMIN"));

router.post("/sessions", startSupportView);
router.post("/sessions/:id/end", endSupportView);
router.get("/audit", listStaffAudit);
router.post("/fleets", createFleet);

export default router;
