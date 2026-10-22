import express from "express";
import { authenticate, authenticateTracking, authorize } from "../middleware/auth.js";
import {
  ingestLocation,
  getLiveLocations,
  reportDeviceStatus,
  reportDrivingEvents,
  getTrackingConfig,
  getLocationHistory,
  getAddress,
} from "../controllers/trackingController.js";

const router = express.Router();

// Accepts either the driver app's normal JWT or a hardware tracker's
// per-vehicle token (x-tracker-token) — see authenticateTracking. Takes a
// single point or a batch of offline-buffered points.
router.post("/ping", authenticateTracking, ingestLocation);

router.get("/live", authenticate, getLiveLocations);
router.get("/address", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), getAddress);
router.get("/history", authenticate, authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), getLocationHistory);

// Driver phone reliability endpoints
router.get("/config", authenticate, authorize("DRIVER"), getTrackingConfig);
router.post("/device-status", authenticate, authorize("DRIVER"), reportDeviceStatus);
router.post("/events", authenticate, authorize("DRIVER"), reportDrivingEvents);

export default router;
