// Figbloom staff (PLATFORM_ADMIN) tools: the read-only support view of a
// customer fleet (lib/supportSession.js), its audit log, and creating a
// fleet for a client.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { toApi, isUniqueViolation } from "../lib/serialize.js";
import { startSupportSession, endSupportSession } from "../lib/supportSession.js";
import { sharedPlatformClient } from "../lib/platform/client.js";
import { registerDecidedCompany } from "../lib/platform/backfill.js";
import { platformDecisionsEnabled } from "../lib/platform/settings.js";
import { getPlatformSettings } from "./settingsController.js";
import { INDUSTRIES, uniqueCompanySlug, sendWelcomeInBackground } from "./authController.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLANS = ["trial", "basic", "pro", "enterprise"];

// Who the staff member is, for the audit rows.
async function staffOf(req) {
  return prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, fullName: true, role: true } });
}

// POST /api/support/sessions { companyId } — start a read-only support view.
export async function startSupportView(req, res) {
  try {
    const companyId = String(req.body?.companyId ?? "").trim();
    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    const staff = await staffOf(req);
    if (!staff) return res.status(401).json({ error: "User account no longer exists" });

    const started = await startSupportSession(prisma, {
      staff,
      companyId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    if (!started) return res.status(404).json({ error: "Company not found" });
    console.log(`[support] ${staff.email} opened ${started.company.name} (${started.company.id}) read-only, session ${started.session.id}`);

    return res.status(201).json({
      token: started.token,
      session: {
        id: started.session.id,
        companyId: started.company.id,
        companyName: started.company.name,
        companyStatus: started.company.status,
        startedAt: started.session.startedAt,
        expiresAt: started.session.expiresAt,
      },
    });
  } catch (err) {
    console.error("[support] start failed", err);
    return res.status(500).json({ error: "Could not open this fleet" });
  }
}

// POST /api/support/sessions/:id/end — exit, with the staff member's own
// (normal) token, so it works even after the support token has expired.
export async function endSupportView(req, res) {
  try {
    const staff = await staffOf(req);
    if (!staff) return res.status(401).json({ error: "User account no longer exists" });
    const session = await endSupportSession(prisma, { staff, sessionId: req.params.id });
    if (!session) return res.status(404).json({ error: "Support view not found" });
    return res.json({ message: "Support view ended", session: toApi(session) });
  } catch (err) {
    console.error("[support] end failed", err);
    return res.status(500).json({ error: "Could not end the support view" });
  }
}

// GET /api/support/audit?companyId= — the latest staff actions, newest first.
export async function listStaffAudit(req, res) {
  try {
    const where = req.query.companyId ? { companyId: String(req.query.companyId) } : {};
    const rows = await prisma.staffAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 });
    return res.json(toApi(rows));
  } catch (err) {
    console.error("[support] audit list failed", err);
    return res.status(500).json({ error: "Could not load the staff activity log" });
  }
}

// POST /api/support/fleets { fleetName, ownerName, ownerEmail, industry?, plan? }
// Figbloom staff setting up a client: an active company and its owner, who
// is emailed a "Set your password" link (their password is random and never
// shown to anyone). Registered with the Figbloom platform the backfill way,
// so it shows in the console as active.
export async function createFleet(req, res) {
  try {
    const fleetName = String(req.body?.fleetName ?? "").trim();
    const ownerName = String(req.body?.ownerName ?? "").trim();
    const ownerEmail = String(req.body?.ownerEmail ?? "").trim().toLowerCase();
    const industry = req.body?.industry || "other";
    const plan = req.body?.plan;

    if (!fleetName || !ownerName || !ownerEmail) {
      return res.status(400).json({ error: "fleetName, ownerName and ownerEmail are required" });
    }
    if (fleetName.length > 120 || ownerName.length > 120) {
      return res.status(400).json({ error: "Names must be 120 characters or fewer" });
    }
    if (!EMAIL.test(ownerEmail)) return res.status(400).json({ error: "ownerEmail is not a valid email address" });
    if (!INDUSTRIES.includes(industry)) {
      return res.status(400).json({ error: `industry must be one of: ${INDUSTRIES.join(", ")}` });
    }
    if (plan !== undefined && !PLANS.includes(plan)) {
      return res.status(400).json({ error: `plan must be one of: ${PLANS.join(", ")}` });
    }

    const existing = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    const staff = await staffOf(req);
    if (!staff) return res.status(401).json({ error: "User account no longer exists" });

    const settings = await getPlatformSettings();
    const subscriptionPlan = plan || settings.defaultPlan;
    const trialEndsAt = subscriptionPlan === "trial" ? new Date(Date.now() + settings.trialDays * 86400000) : null;
    const slug = await uniqueCompanySlug(fleetName);
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 10);

    const [company, owner] = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: fleetName, slug, status: "active", industry, subscriptionPlan, trialEndsAt },
      });
      const owner = await tx.user.create({
        data: { email: ownerEmail, passwordHash, fullName: ownerName, role: "COMPANY_OWNER", companyId: company.id },
      });
      await tx.staffAuditLog.create({
        data: {
          staffUserId: staff.id,
          staffEmail: staff.email,
          action: "fleet_created",
          companyId: company.id,
          details: { fleetName, ownerEmail, plan: subscriptionPlan },
        },
      });
      return [company, owner];
    });

    // The owner sets their own password from the email (as for admins and drivers).
    sendWelcomeInBackground(owner, company.name);

    // Never fails the request: the result tells staff whether it reached the console.
    let platform;
    try {
      platform = await registerDecidedCompany(prisma, sharedPlatformClient(), company.id, {
        decisionsOn: platformDecisionsEnabled(),
        source: "staff create fleet (console decision)",
      });
    } catch (err) {
      console.error(`[platform] could not register staff-created company ${company.id}:`, err.message);
      platform = { result: "error", error: err.message };
    }
    console.log(`[staff] ${staff.email} created fleet ${company.name} (${company.id}) for ${ownerEmail}; platform: ${platform.result ?? (platform.queued ? "queued" : "not configured")}`);

    return res.status(201).json({
      message: `${company.name} created. ${owner.email} has been emailed a link to set their password.`,
      company: toApi(company),
      owner: { id: owner.id, email: owner.email, fullName: owner.fullName, role: owner.role },
      platform,
    });
  } catch (err) {
    if (isUniqueViolation(err) && String(err.meta?.target ?? "").includes("email")) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    console.error("[staff] create fleet failed", err);
    return res.status(500).json({ error: "Could not create the fleet" });
  }
}
