import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listCompanies,
  getCompany,
  updateCompanyStatus,
  getMyCompany,
  updateMyCompany,
  updateStartPoint,
} from "../controllers/companyController.js";

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("PLATFORM_ADMIN"), listCompanies);
router.get("/me", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN", "DRIVER"), getMyCompany);
router.patch("/me", authorize("COMPANY_OWNER"), updateMyCompany);
router.patch("/me/start-point", authorize("ADMIN", "COMPANY_OWNER"), updateStartPoint);
router.get("/:id", authorize("PLATFORM_ADMIN"), getCompany);
router.patch("/:id/status", authorize("PLATFORM_ADMIN"), updateCompanyStatus);

export default router;