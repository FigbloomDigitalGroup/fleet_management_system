import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { loginLimiter, forgotPasswordLimiter } from "../middleware/rateLimiter.js";
import {
  registerCompany,
  createUserUnderCompany,
  login,
  refresh,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register-company", registerCompany);
router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPassword);

router.post(
  "/users",
  authenticate,
  authorize("COMPANY_OWNER", "PLATFORM_ADMIN", "ADMIN"),
  createUserUnderCompany
);

export default router;