import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { getSettings, updateSettings } from "../controllers/settingsController.js";

const router = express.Router();
router.use(authenticate, authorize("PLATFORM_ADMIN"));

router.get("/", getSettings);
router.patch("/", updateSettings);

export default router;