import express from "express";
import { authenticate } from "../middleware/auth.js";
import { listTrips, getTrip } from "../controllers/tripController.js";

const router = express.Router();
router.get("/", authenticate, listTrips);
router.get("/:id", authenticate, getTrip);

export default router;