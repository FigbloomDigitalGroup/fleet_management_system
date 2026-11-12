import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { sharedPlatformClient } from "../lib/platform/client.js";
import { makeHrHandlers } from "../lib/platform/hrAccess.js";

// Figbloom HR for signed-in people (lib/platform/hrAccess.js). Who may use
// what is checked in the handlers (owner / full admin / accountant for HR &
// Payroll; anyone in a company for My HR) and, for staff roles and
// restricted admins, centrally in middleware/auth.js.
const hr = makeHrHandlers({ db: prisma, getClient: sharedPlatformClient });

const router = express.Router();
router.use(authenticate);
router.get("/status", hr.status);
router.post("/handoff", hr.handoff);
router.get("/unavailability", hr.unavailability);
router.use("/my", hr.myHr);

export default router;
