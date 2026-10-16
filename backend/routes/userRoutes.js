import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listAdmins,
  listDrivers,
  getDriverById,
  getMyProfile,
  updateMyProfile,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/me", authenticate, getMyProfile);
router.patch("/me", authenticate, updateMyProfile);
router.get("/admins", authenticate, authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), listAdmins);
router.get("/drivers", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), listDrivers);
router.get("/drivers/:id", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), getDriverById);

export default router;