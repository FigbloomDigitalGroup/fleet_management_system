import express from "express";
import { authenticate } from "../middleware/auth.js";
import { listTrips, getTrip, getTripPath } from "../controllers/tripController.js";

const router = express.Router();
router.get("/", authenticate, listTrips);
router.get("/:id", authenticate, getTrip);
router.get("/:id/path", authenticate, getTripPath);


export default router;




