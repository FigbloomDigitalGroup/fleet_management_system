import express from "express";
import { authenticate, authenticateIdentity, authorize } from "../middleware/auth.js";
import { handleSpreadsheetUpload } from "../middleware/upload.js";
import {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  registerLimiter,
} from "../middleware/rateLimiter.js";
import {
  registerCompany,
  createUserUnderCompany,
  bulkImportDrivers,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  createFleetForMe,
  myMemberships,
  switchFleet,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register-company", registerLimiter, registerCompany);
router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);

// One account, many fleets (FLEET_MEMBERSHIPS_CONTRACT.md section 2): these
// work from any fleet the person is signed into, or none.
router.get("/memberships", authenticateIdentity, myMemberships);
router.post("/switch-fleet", authenticateIdentity, switchFleet);
router.post("/fleets", registerLimiter, authenticateIdentity, createFleetForMe);

router.post(
  "/users",
  authenticate,
  authorize("COMPANY_OWNER", "PLATFORM_ADMIN", "ADMIN"),
  createUserUnderCompany
);

router.post(
  "/users/bulk-import",
  authenticate,
  authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"),
  handleSpreadsheetUpload,
  bulkImportDrivers
);

export default router;