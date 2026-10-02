import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { handleSpreadsheetUpload } from "../middleware/upload.js";
import {
  createVehicle,
  bulkImportVehicles,
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
router.post(
  "/bulk-import",
  authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"),
  handleSpreadsheetUpload,
  bulkImportVehicles
);
router.put("/:id", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), updateVehicle);
router.delete("/:id", authorize("COMPANY_OWNER", "PLATFORM_ADMIN"), deleteVehicle);

export default router;







