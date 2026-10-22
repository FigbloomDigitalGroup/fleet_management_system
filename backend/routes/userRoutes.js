import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listAdmins,
  listDrivers,
  getDriverById,
  getMyProfile,
  updateMyProfile,
  getDriverScore,
  listDriverScores,
  getMyScore,
  acceptTrackingConsent,
  updateAdminAccess,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/me", authenticate, getMyProfile);
router.patch("/me", authenticate, updateMyProfile);
router.get("/me/score", authenticate, authorize("DRIVER"), getMyScore);
router.post("/me/consent", authenticate, authorize("DRIVER"), acceptTrackingConsent);
router.patch("/admins/:id/access", authenticate, authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), updateAdminAccess);
router.get("/drivers/scores", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), listDriverScores);
router.get("/drivers/:id/score", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), getDriverScore);
router.get("/admins", authenticate, authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), listAdmins);
router.get("/drivers", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), listDrivers);
router.get("/drivers/:id", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), getDriverById);

export default router;