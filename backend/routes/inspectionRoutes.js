import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getInspectionTemplate,
  createInspection,
  listMyInspections,
  listInspections,
} from "../controllers/inspectionController.js";

const router = express.Router();
router.use(authenticate);

router.get("/template", getInspectionTemplate);
router.get("/mine", authorize("DRIVER"), listMyInspections);
router.post("/", authorize("DRIVER"), createInspection);
router.get("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), listInspections);

export default router;
