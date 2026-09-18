import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { listScans, triggerScan, getAgentSummary, askAboutFleet } from "../controllers/agentController.js";

const router = express.Router();
router.use(authenticate);

// Company-scoped presence + stats — for the fleet's own Admin/Company Owner,
// not the full platform-wide operational view below.
router.get("/summary", authorize("ADMIN", "COMPANY_OWNER"), getAgentSummary);
router.post("/ask", authorize("ADMIN", "COMPANY_OWNER"), askAboutFleet);

router.get("/scans", authorize("PLATFORM_ADMIN"), listScans);
router.post("/scan-now", authorize("PLATFORM_ADMIN"), triggerScan);

export default router;
