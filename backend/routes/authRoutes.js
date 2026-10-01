import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
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
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register-company", registerLimiter, registerCompany);
router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);

router.post(
  "/users",
  authenticate,
  authorize("COMPANY_OWNER", "PLATFORM_ADMIN", "ADMIN"),
  createUserUnderCompany
);

router.post(
  "/users/bulk-import",
  authenticate,
  authorize("COMPANY_OWNER", "PLATFORM_ADMIN", "ADMIN"),
  handleSpreadsheetUpload,
  bulkImportDrivers
);

export default router;