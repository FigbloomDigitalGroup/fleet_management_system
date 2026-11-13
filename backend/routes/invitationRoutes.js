import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { inviteLimiter, invitationAcceptLimiter, invitationViewLimiter } from "../middleware/rateLimiter.js";
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  viewInvitation,
  acceptInvitation,
} from "../controllers/invitationController.js";

// Invite by email (FLEET_MEMBERSHIPS_CONTRACT.md section 3).
const router = express.Router();

// The invited person: open the link, accept (no fleet session needed).
router.get("/token/:token", invitationViewLimiter, viewInvitation);
router.post("/token/:token/accept", invitationAcceptLimiter, acceptInvitation);

// The fleet's owner and full admins (checked in the controller).
const managers = [authenticate, authorize("COMPANY_OWNER", "ADMIN", "PLATFORM_ADMIN")];
router.get("/", ...managers, listInvitations);
router.post("/", ...managers, inviteLimiter, createInvitation);
router.post("/:id/resend", ...managers, inviteLimiter, resendInvitation);
router.post("/:id/revoke", ...managers, revokeInvitation);

export default router;
