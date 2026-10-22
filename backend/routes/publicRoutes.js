import express from "express";
import rateLimit from "express-rate-limit";
import { getPublicTracking } from "../controllers/jobController.js";

const router = express.Router();

// No login — the customer only has the link — so it's rate limited instead.
const trackLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });

router.get("/track/:token", trackLimiter, getPublicTracking);

export default router;
