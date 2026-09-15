import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle,
} from "../controllers/vehicleController.js";

const router = express.Router();
router.use(authenticate);

router.get("/", listVehicles);
router.get("/:id", getVehicle);
router.post("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), createVehicle);
router.put("/:id", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), updateVehicle);
router.delete("/:id", authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), deleteVehicle); // Admin excluded

export default router;












