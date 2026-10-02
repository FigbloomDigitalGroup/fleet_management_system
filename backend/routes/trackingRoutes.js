import express from "express";
import { authenticate } from "../middleware/auth.js";
import { ingestLocation, getLiveLocations } from "../controllers/trackingController.js";

const router = express.Router();

// NOTE: In production, protect this with a device API key instead of user auth,
// since GPS trackers/mobile devices aren't logged-in users. For now it's left
// open so the driver app's expo-location sharing can call it directly.
router.post("/ping", ingestLocation);

router.get("/live", authenticate, getLiveLocations);

export default router;