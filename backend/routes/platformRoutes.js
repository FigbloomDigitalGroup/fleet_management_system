import express from "express";
import { requirePlatformConsoleSecret } from "../middleware/platformConsoleAuth.js";
import { receiveDecision, receiveEvent, listCompanySummaries, getCompanySummary } from "../controllers/platformController.js";

const router = express.Router();

// The signature covers the exact bytes sent, so this route gets the raw body
// (Index.js skips express.json() for it).
router.post("/decisions", express.raw({ type: () => true, limit: "16kb" }), receiveDecision);
// Events from the relay (hr.employee.left, hr.leave.*): data is at most 64 KB.
router.post("/events", express.raw({ type: () => true, limit: "80kb" }), receiveEvent);

router.get("/companies", requirePlatformConsoleSecret, listCompanySummaries);
router.get("/companies/:id", requirePlatformConsoleSecret, getCompanySummary);

export default router;
