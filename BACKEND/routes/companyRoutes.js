import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listCompanies,
  getCompany,
  updateCompanyStatus,
  getMyCompany,
} from "../controllers/companyController.js";

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("PLATFORM_ADMIN"), listCompanies);
router.get("/me", authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), getMyCompany);
router.get("/:id", authorize("PLATFORM_ADMIN"), getCompany);
router.patch("/:id/status", authorize("PLATFORM_ADMIN"), updateCompanyStatus);

export default router;