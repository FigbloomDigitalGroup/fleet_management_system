import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { listAdmins } from "../controllers/userController.js";

const router = express.Router();

router.get("/admins", authenticate, authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), listAdmins);

export default router;