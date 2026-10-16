import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { createRoute, listRoutes, getRouteForVehicle, getMyRoute, deleteRoute } from "../controllers/routeController.js";

const router = express.Router();
router.use(authenticate);

router.get("/", listRoutes);
router.get("/mine", getMyRoute);
router.get("/vehicle/:vehicleId", getRouteForVehicle);
router.post("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), createRoute);
router.delete("/:id", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), deleteRoute);

export default router;