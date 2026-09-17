/*
import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle,
  getMyVehicle,
  setMyVehicleStatus,
  setVehicleOffline,
} from "../controllers/vehicleController.js";

const router = express.Router();
router.use(authenticate);

router.get("/", listVehicles);
router.get("/me/assigned", authorize("DRIVER"), getMyVehicle);
router.patch("/me/status", authorize("DRIVER"), setMyVehicleStatus);
router.post("/me/stop-tracking", authorize("DRIVER"), setVehicleOffline);
router.get("/:id", getVehicle);
router.post("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), createVehicle);
router.put("/:id", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), updateVehicle);
router.delete("/:id", authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), deleteVehicle);

export default router;
*/


import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle,
  getMyVehicle,
} from "../controllers/vehicleController.js";

const router = express.Router();
router.use(authenticate);

router.get("/mine", getMyVehicle);
router.get("/", listVehicles);
router.get("/:id", getVehicle);
router.post("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), createVehicle);
router.put("/:id", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), updateVehicle);
router.delete("/:id", authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), deleteVehicle);

export default router;



