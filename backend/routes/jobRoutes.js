import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  optimizeJobs,
  listMyJobs,
  getMyJob,
  updateMyJobStatus,
} from "../controllers/jobController.js";

const router = express.Router();
router.use(authenticate);

const dispatch = authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN");

router.get("/mine", authorize("DRIVER"), listMyJobs);
router.get("/mine/:id", authorize("DRIVER"), getMyJob);
router.post("/:id/status", authorize("DRIVER"), updateMyJobStatus);
router.get("/", dispatch, listJobs);
router.post("/optimize", dispatch, optimizeJobs);
router.post("/", dispatch, createJob);
router.get("/:id", dispatch, getJob);
router.put("/:id", dispatch, updateJob);
router.delete("/:id", dispatch, deleteJob);

export default router;
