import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listMaintenance,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  completeReminder,
} from "../controllers/maintenanceController.js";

const router = express.Router();
router.use(authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"));

router.get("/", listMaintenance);
router.post("/", createMaintenance);
router.put("/:id", updateMaintenance);
router.delete("/:id", deleteMaintenance);
router.post("/:id/complete", completeReminder);

export default router;
