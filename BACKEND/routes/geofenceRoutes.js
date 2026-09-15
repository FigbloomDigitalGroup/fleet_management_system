import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { createGeofence, listGeofences, deleteGeofence } from "../controllers/geofenceController.js";

const router = express.Router();
router.use(authenticate);

router.get("/", listGeofences);
router.post("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), createGeofence);
router.delete("/:id", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), deleteGeofence);

export default router;