import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listTrips,
  getTrip,
  getTripPath,
  getTripRoad,
  listMyTrips,
  getMyCurrentTrip,
  updateMyCurrentTrip,
  endMyCurrentTrip,
} from "../controllers/tripController.js";

const router = express.Router();
router.get("/me/mine", authenticate, listMyTrips);
router.get("/me/current", authenticate, authorize("DRIVER"), getMyCurrentTrip);
router.patch("/me/current", authenticate, authorize("DRIVER"), updateMyCurrentTrip);
router.post("/me/current/end", authenticate, authorize("DRIVER"), endMyCurrentTrip);
router.get("/", authenticate, listTrips);
router.get("/:id", authenticate, getTrip);
router.get("/:id/path", authenticate, getTripPath);
router.get("/:id/road", authenticate, getTripRoad);

export default router;




