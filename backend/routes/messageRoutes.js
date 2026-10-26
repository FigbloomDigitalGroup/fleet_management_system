import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listThreads,
  getThread,
  getMyThread,
  getMyUnreadCount,
  sendMessage,
  hideMyMessage,
} from "../controllers/messageController.js";

const router = express.Router();
router.use(authenticate);

router.get("/mine", authorize("DRIVER"), getMyThread);
router.delete("/mine/:id", authorize("DRIVER"), hideMyMessage);
router.get("/mine/unread-count", authorize("DRIVER"), getMyUnreadCount);
router.get("/threads", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), listThreads);
router.get("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), getThread);
router.post("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN", "DRIVER"), sendMessage);

export default router;
