import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimiter.js";
import {
  registerCompany,
  createUserUnderCompany,
  login,
  refresh,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register-company", registerCompany);
router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);

router.post(
  "/users",
  authenticate,
  authorize("COMPANY_OWNER", "PLATFORM_ADMIN", "ADMIN"),
  createUserUnderCompany
);

export default router;