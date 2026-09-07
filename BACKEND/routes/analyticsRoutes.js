import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { getPlatformAnalytics } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/platform", authenticate, authorize("PLATFORM_ADMIN"), getPlatformAnalytics);

export default router;