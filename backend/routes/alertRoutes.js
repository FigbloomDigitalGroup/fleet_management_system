import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { listAlerts, resolveAlert, createAlert, getMyAlerts, hideMyAlert } from "../controllers/alertController.js";

const router = express.Router();
router.get("/mine", authenticate, authorize("DRIVER"), getMyAlerts);
router.delete("/mine/:id", authenticate, authorize("DRIVER"), hideMyAlert);
router.get("/", authenticate, listAlerts);
router.post("/", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN", "DRIVER"), createAlert);
router.patch("/:id/resolve", authenticate, resolveAlert);

export default router;















