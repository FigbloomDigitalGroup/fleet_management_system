import express from "express";
import { authenticate } from "../middleware/auth.js";
import { createUpload, serveUpload } from "../controllers/uploadController.js";

const router = express.Router();
router.post("/", authenticate, createUpload);
router.get("/:id/raw", serveUpload);

export default router;
