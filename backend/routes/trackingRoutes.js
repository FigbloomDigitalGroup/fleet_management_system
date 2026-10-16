import express from "express";
import { authenticate, authenticateTracking } from "../middleware/auth.js";
import { ingestLocation, getLiveLocations } from "../controllers/trackingController.js";

const router = express.Router();

// Accepts either the driver app's normal JWT or a hardware tracker's
// per-vehicle token (x-tracker-token) — see authenticateTracking.
router.post("/ping", authenticateTracking, ingestLocation);

router.get("/live", authenticate, getLiveLocations);

export default router;