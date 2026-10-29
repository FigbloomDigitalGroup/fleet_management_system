import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listCompanies,
  getCompany,
  updateCompanyStatus,
  getMyCompany,
  updateMyCompany,
  updateMyAppearance,
  updateStartPoint,
  updateMyPlan,
  getMyCompanyStats,
  getMyDailyStats,
  updateMyRevenue,
  getCompanyStats,
  updateMyLogo,
} from "../controllers/companyController.js";
import { getMySettings, updateMySettings } from "../controllers/settingsCompanyController.js";

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("PLATFORM_ADMIN"), listCompanies);
router.get("/me", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN", "DRIVER"), getMyCompany);
router.patch("/me", authorize("COMPANY_OWNER"), updateMyCompany);
router.patch("/me/appearance", authorize("COMPANY_OWNER"), updateMyAppearance);
router.patch("/me/start-point", authorize("ADMIN", "COMPANY_OWNER"), updateStartPoint);
router.patch("/me/plan", authorize("COMPANY_OWNER"), updateMyPlan);
router.get("/me/stats", authorize("ADMIN", "COMPANY_OWNER"), getMyCompanyStats);
router.get("/me/stats/daily", authorize("ADMIN", "COMPANY_OWNER"), getMyDailyStats);
router.get("/me/settings", authorize("ADMIN", "COMPANY_OWNER"), getMySettings);
router.put("/me/settings", authorize("ADMIN", "COMPANY_OWNER"), updateMySettings);
router.patch("/me/revenue", authorize("COMPANY_OWNER"), updateMyRevenue);
router.patch("/me/logo", authorize("COMPANY_OWNER"), updateMyLogo);
router.get("/:id", authorize("PLATFORM_ADMIN"), getCompany);
router.get("/:id/stats", authorize("PLATFORM_ADMIN"), getCompanyStats);
router.patch("/:id/status", authorize("PLATFORM_ADMIN"), updateCompanyStatus);

export default router;