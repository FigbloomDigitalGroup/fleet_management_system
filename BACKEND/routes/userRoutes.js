import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { listAdmins, listDrivers } from "../controllers/userController.js";

const router = express.Router();

router.get("/admins", authenticate, authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), listAdmins);
router.get("/drivers", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), listDrivers);

export default router;