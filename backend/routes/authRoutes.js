import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  registerLimiter,
} from "../middleware/rateLimiter.js";
import {
  registerCompany,
  createUserUnderCompany,
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

export default router;