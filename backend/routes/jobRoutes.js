import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  optimizeJobs,
  listJobRoutes,
  getMyJobRoute,
  listMyJobs,
  getMyJob,
  updateMyJobStatus,
} from "../controllers/jobController.js";

const router = express.Router();
router.use(authenticate);

const dispatch = authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN");

router.get("/mine", authorize("DRIVER"), listMyJobs);
router.get("/mine/route", authorize("DRIVER"), getMyJobRoute);
router.get("/mine/:id", authorize("DRIVER"), getMyJob);
router.post("/:id/status", authorize("DRIVER"), updateMyJobStatus);
router.get("/", dispatch, listJobs);
router.post("/optimize", dispatch, optimizeJobs);
router.get("/routes", dispatch, listJobRoutes);
router.post("/", dispatch, createJob);
router.get("/:id", dispatch, getJob);
router.put("/:id", dispatch, updateJob);
router.delete("/:id", dispatch, deleteJob);

export default router;
