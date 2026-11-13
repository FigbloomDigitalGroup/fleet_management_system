import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { toApi, isUniqueViolation } from "../lib/serialize.js";
import { sendPasswordResetEmail, sendCompanyWelcomeEmail, sendUserWelcomeEmail, frontendUrl } from "../lib/mailer.js";
import { parseSpreadsheetRows } from "../lib/spreadsheet.js";
import { getPlatformSettings } from "./settingsController.js";
import { platformDecisionsEnabled } from "../lib/platform/settings.js";
import { enqueueCompanySync } from "../lib/platform/store.js";
import { enqueueStaffSyncSafely } from "../lib/platform/staffEvents.js";
import { STAFF_ROLES, canManageTeam } from "../lib/staffRoles.js";
import { companyRefusal, chooseMembership, membershipsOf, usableMemberships, usableOn, NO_FLEET_MESSAGE } from "../lib/memberships.js";
import { hashToken, sessionResponse } from "../lib/session.js";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const WELCOME_LINK_DAYS = 3; // "Set your password" link in the welcome email
const MAX_IMPORT_ROWS = 500;

function generateTempPassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Emails a user the company just added: a "Set your password" link (the same
// mechanism as a password reset, valid WELCOME_LINK_DAYS) plus how to sign
// in. Runs in the background — a slow or failed email never fails the
// request that created the user.
export function sendWelcomeInBackground(user, companyName) {
  (async () => {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordTokenHash: hashResetToken(token),
        resetPasswordExpires: new Date(Date.now() + WELCOME_LINK_DAYS * 86400000),
      },
    });
    const setPasswordLink = `${frontendUrl()}/reset-password?email=${encodeURIComponent(user.email)}&token=${token}`;
    await sendUserWelcomeEmail(user.email, {
      fullName: user.fullName,
      companyName,
      role: user.role,
      setPasswordLink,
      validDays: WELCOME_LINK_DAYS,
    });
  })().catch((err) => console.error(`[welcome email] failed for ${user.email}:`, err.message));
}

const companyNameOf = async (companyId) =>
  (await prisma.company.findUnique({ where: { id: String(companyId) }, select: { name: true } }))?.name ?? "your company";

// "Amina Wanjiru" -> "Amina's Fleet"; "" when there is no usable name.
export function defaultFleetName(ownerName) {
  const first = String(ownerName ?? "").trim().split(/\s+/)[0];
  return first ? `${first}'s Fleet` : "";
}

// Registers a new fleet (Company) + its first user (COMPANY_OWNER). The
// company can be a registered business or just one person's vehicles.
export const INDUSTRIES = [
  "logistics_courier",
  "public_transport",
  "school_transport",
  "construction",
  "taxi_ride_hailing",
  "security_cash_transit",
  "agriculture",
  "government_municipal",
  "oil_gas",
  "rental_car",
  "other",
];

// Someone signing up with an email that already has an account signs in
// first and adds the new fleet from there (createFleetForMe): one email is
// one account (FLEET_MEMBERSHIPS_CONTRACT.md section 3).
const ACCOUNT_EXISTS = {
  code: "account_exists",
  error: "You already have a Figbloom Fleet account with this email. Sign in first, then you can add this new fleet to your account.",
};

function validateFleetDetails(body) {
  const { industry } = body;
  if (industry !== undefined && industry !== "" && !INDUSTRIES.includes(industry)) {
    return `industry must be one of: ${INDUSTRIES.join(", ")}`;
  }
  return null;
}

// A new company and its owner's membership, in one transaction (tx), queued
// for the Figbloom platform. -> { company, membership, approval }
async function createCompanyForOwner(tx, { companyName, industry, ownerId, settings }) {
  const slug = await uniqueCompanySlug(companyName);
  const subscriptionPlan = settings.defaultPlan;
  const trialEndsAt =
    subscriptionPlan === "trial" ? new Date(Date.now() + settings.trialDays * 24 * 60 * 60 * 1000) : null;
  // Once the Figbloom console decides, every new company starts pending
  // here; the platform's answer (pending, or active with its auto-approve)
  // is then applied by the sync (lib/platform/sync.js).
  const approval = approvalMode(settings);
  const company = await tx.company.create({
    data: {
      name: companyName,
      slug,
      status: approval !== "auto" ? "pending" : "active",
      industry: industry || "other",
      subscriptionPlan,
      trialEndsAt,
    },
  });
  const membership = await tx.membership.create({
    data: { userId: ownerId, companyId: company.id, role: "COMPANY_OWNER" },
  });
  // registered with the Figbloom platform by the every-minute sync
  await enqueueCompanySync(tx, company.id);
  return { company, membership: { ...membership, company }, approval };
}

export async function registerCompany(req, res) {
  try {
    const { ownerName, email, password, industry } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    // Individuals with a few vehicles don't need a business name: with none
    // given, the fleet is called "<first name>'s Fleet" (editable later).
    const companyName = String(req.body.companyName ?? "").trim() || defaultFleetName(ownerName);

    if (!companyName || !ownerName || !normalizedEmail || !password) {
      return res.status(400).json({ error: "ownerName, email, and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const invalid = validateFleetDetails(req.body);
    if (invalid) return res.status(400).json({ error: invalid });

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (existing) return res.status(409).json(ACCOUNT_EXISTS);

    // Without these the account would be created but sign-in tokens couldn't
    // be issued — refuse before writing anything, and say why in the logs.
    if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
      console.error("[register-company] JWT_SECRET or REFRESH_TOKEN_SECRET is not set");
      return res.status(500).json({ error: "Registration is unavailable right now — the server is missing its sign-in settings" });
    }

    const settings = await getPlatformSettings();
    const passwordHash = await bcrypt.hash(password, 10);
    // Company, owner and membership together, so a failure can't leave an ownerless company.
    const { company, membership, approval, user } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: normalizedEmail, passwordHash, fullName: ownerName } });
      const created = await createCompanyForOwner(tx, { companyName, industry, ownerId: user.id, settings });
      return { ...created, user };
    });
    // the owner, to Figbloom HR (only while HR_INTEGRATION_ENABLED is on)
    await enqueueStaffSyncSafely(prisma, user.id, company.id);

    sendCompanyWelcomeEmail(user.email, {
      ownerName: user.fullName,
      companyName: company.name,
      pending: company.status === "pending",
    }).catch((err) => console.error(`[welcome email] failed for ${user.email}:`, err.message));

    const session = await sessionResponse(prisma, user, membership, { app: "web" });
    return res.status(201).json({
      message: "Company and owner account created",
      company: toApi(company),
      // How a pending company gets switched on, so the "received" screen can
      // say what really happens next: "console" (the Figbloom console's
      // per-product auto-approve or a person there decides, usually within
      // minutes), "manual" (Figbloom staff approve it here), or "auto".
      approval,
      supportEmail: settings.supportEmail,
      ...session,
    });
  } catch (err) {
    console.error("[register-company]", err);
    // Two sign-ups racing for the same email.
    if (isUniqueViolation(err) && String(err.meta?.target ?? "").includes("email")) {
      return res.status(409).json(ACCOUNT_EXISTS);
    }
    return res.status(500).json({ error: "Failed to register company", code: err?.code });
  }
}

// POST /api/auth/fleets { companyName, industry? } (signed in, anyone: an
// owner, a team member, a driver, Figbloom staff, or someone in no fleet):
// a new company with them as its owner, as another membership. No password
// step: they are already signed in. It goes through the normal approval
// (pending until approved in the console, registered by the platform outbox
// as any new company). An active company is switched into straight away
// (new tokens, web); a pending one waits, the session stays where it was,
// and the web app switches in once it is approved (the fleet switcher
// watches it). The driver app gets no session for it (owners use the web).
export async function createFleetForMe(req, res) {
  try {
    const me = req.identity;
    const companyName = String(req.body.companyName ?? "").trim() || defaultFleetName(me.fullName);
    if (!companyName) return res.status(400).json({ error: "Give your new fleet a name" });
    if (companyName.length > 120) return res.status(400).json({ error: "The fleet name must be 120 characters or fewer" });
    const invalid = validateFleetDetails(req.body);
    if (invalid) return res.status(400).json({ error: invalid });

    const settings = await getPlatformSettings();
    const { company, membership, approval } = await prisma.$transaction((tx) =>
      createCompanyForOwner(tx, { companyName, industry: req.body.industry, ownerId: me.id, settings })
    );
    await enqueueStaffSyncSafely(prisma, me.id, company.id);
    sendCompanyWelcomeEmail(me.email, {
      ownerName: me.fullName,
      companyName: company.name,
      pending: company.status === "pending",
    }).catch((err) => console.error(`[welcome email] failed for ${me.email}:`, err.message));

    const user = { id: me.id, email: me.email, fullName: me.fullName, isPlatformAdmin: me.isPlatformAdmin };
    const switchNow = company.status === "active" && me.app !== "mobile";
    const session = switchNow ? await sessionResponse(prisma, user, membership, { app: me.app ?? "web" }) : {};
    return res.status(201).json({
      message: `${company.name} has been added to your account`,
      company: toApi(company),
      approval,
      supportEmail: settings.supportEmail,
      ...session,
    });
  } catch (err) {
    console.error("[create-fleet]", err);
    return res.status(500).json({ error: "Could not create the fleet. Please try again." });
  }
}

// How a newly registered company is switched on. With Figbloom-console
// decisions on, the console decides (its per-product auto-approve, or a
// person there) and requireManualApproval is not used; otherwise the
// platform setting decides between staff approval and straight to active.
export function approvalMode(settings, env = process.env) {
  if (platformDecisionsEnabled(env)) return "console";
  return settings.requireManualApproval ? "manual" : "auto";
}

// "Acme Logistics" → "acme-logistics"; if another company already has that,
// "acme-logistics-2", "-3"… Names with no usable letters fall back to "company".
export async function uniqueCompanySlug(companyName) {
  const base =
    companyName.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
    "company";
  const taken = new Set(
    (await prisma.company.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((c) => c.slug)
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

// The 409 for an email that already has an account: they join by invitation
// (with the account they have), not with a second password.
const INVITE_INSTEAD = {
  code: "account_exists",
  error: "This email already has a Figbloom Fleet account. Invite them by email instead (Settings, Team) and they join with the account they already have.",
};

// Creates a Driver with a password the owner types (drivers without an
// email inbox, and the driver app's sign-in), under the requester's own
// company, or under body.companyId for PLATFORM_ADMIN. Team members (ADMIN
// and the staff roles) are invited by email instead (POST /api/invitations,
// FLEET_MEMBERSHIPS_CONTRACT.md section 3): typed passwords are for drivers only.
export async function createUserUnderCompany(req, res) {
  try {
    const { email, password, fullName, role } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const allowedRoles = ["ADMIN", ...STAFF_ROLES, "DRIVER"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(", ")}` });
    }
    if (role !== "DRIVER") {
      if (req.user.role !== "PLATFORM_ADMIN" && !canManageTeam(req.user)) {
        return res.status(403).json({ error: "Only the fleet owner or a full admin can add team members" });
      }
      return res.status(400).json({
        code: "invite_instead",
        error: "Team members are now invited by email: they choose their own password. Use Invite on the Team page.",
      });
    }
    // Owners add drivers themselves (a one-person fleet needs no admin);
    // the driver always lands in the requester's own company (below).
    if (!["ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only the fleet owner or a fleet admin can add drivers" });
    }
    if (!normalizedEmail) {
      return res.status(400).json({ error: "email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "companyId is required" });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (existing) {
      const member = await prisma.membership.findUnique({
        where: { userId_companyId: { userId: existing.id, companyId: String(companyId) } },
        select: { id: true },
      });
      if (member) return res.status(409).json({ code: "already_member", error: "This person is already in your fleet" });
      return res.status(409).json(INVITE_INSTEAD);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email: normalizedEmail, passwordHash, fullName } });
      await tx.membership.create({
        data: { userId: created.id, companyId: String(companyId), role: "DRIVER", invitedById: req.user.id },
      });
      return created;
    });
    sendWelcomeInBackground({ ...user, role }, await companyNameOf(companyId));
    await enqueueStaffSyncSafely(prisma, user.id, String(companyId));

    return res.status(201).json({
      message: `${role} account created`,
      user: { id: user.id, email: user.email, role, companyId: String(companyId) },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json(INVITE_INSTEAD);
    console.error(err);
    return res.status(500).json({ error: "Failed to create user" });
  }
}

// Bulk-creates DRIVER accounts from an uploaded .xlsx/.csv file — same
// validation rules as createUserUnderCompany, applied per row. Expected
// columns (case/spacing-insensitive): fullName, email, password (optional —
// a temporary one is generated and returned if left blank).
export async function bulkImportDrivers(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let rows;
    try {
      rows = await parseSpreadsheetRows(req.file.buffer, req.file.originalname);
    } catch (err) {
      return res.status(400).json({ error: "Could not read that file — make sure it's a valid .xlsx or .csv" });
    }

    if (rows.length === 0) return res.status(400).json({ error: "The file has no data rows" });
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `Too many rows — max ${MAX_IMPORT_ROWS} per import` });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    const results = [];
    let createdCount = 0;
    let companyName; // looked up once, on the first created driver

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // header is row 1
      const fullName = row.fullname || row.name || "";
      const email = String(row.email || "").trim().toLowerCase();
      let password = row.password ? String(row.password) : "";
      let generatedPassword = null;

      if (!fullName) {
        results.push({ row: rowNumber, email, status: "failed", error: "fullName is required" });
        continue;
      }
      if (!email) {
        results.push({ row: rowNumber, email, status: "failed", error: "email is required" });
        continue;
      }
      if (!password) {
        password = generateTempPassword();
        generatedPassword = password;
      } else if (password.length < 8) {
        results.push({ row: rowNumber, email, status: "failed", error: "password must be at least 8 characters" });
        continue;
      }
      if (!companyId) {
        results.push({ row: rowNumber, email, status: "failed", error: "companyId is required" });
        continue;
      }

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        results.push({ row: rowNumber, email, status: "failed", error: "This email already has an account: invite them by email instead" });
        continue;
      }

      try {
        const passwordHash = await bcrypt.hash(password, 10);
        const created = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({ data: { email, passwordHash, fullName: String(fullName) } });
          await tx.membership.create({ data: { userId: user.id, companyId: String(companyId), role: "DRIVER", invitedById: req.user.id } });
          return user;
        });
        companyName ??= await companyNameOf(companyId);
        sendWelcomeInBackground({ ...created, role: "DRIVER" }, companyName);
        await enqueueStaffSyncSafely(prisma, created.id, String(companyId));
        results.push({ row: rowNumber, email, status: "created", generatedPassword });
        createdCount++;
      } catch (err) {
        if (isUniqueViolation(err)) {
          results.push({ row: rowNumber, email, status: "failed", error: "This email already has an account: invite them by email instead" });
        } else {
          results.push({ row: rowNumber, email, status: "failed", error: "Could not save this row" });
        }
      }
    }

    return res.status(201).json({ createdCount, failedCount: results.length - createdCount, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to import drivers" });
  }
}

// A company that can't be worked in (pending, suspended, rejected, trial
// over): the 403 the web sign-in page turns into a status screen (the app
// just shows `error`).
async function refuseCompany(res, company, [code, error]) {
  const settings = await getPlatformSettings();
  return res.status(403).json({
    error,
    code,
    companyName: company.name,
    registeredAt: company.createdAt,
    approval: approvalMode(settings),
    supportEmail: settings.supportEmail,
  });
}

const NOT_A_DRIVER = "This account isn't a driver account. Sign in from the FIGBLOOM FLEET web dashboard instead.";
const DRIVERS_USE_THE_APP = "Driver accounts sign in from the FIGBLOOM FLEET mobile app, not the web dashboard.";

// Login for any role, including Drivers (mobile app). With memberships
// (FLEET_MEMBERSHIPS_CONTRACT.md section 2): one fleet -> straight in, as
// before; several -> the one asked for (body.companyId), else the last used
// one; the response also lists them (memberships[]) for the fleet switcher.
// The `user` fields are the same as before memberships.
export async function login(req, res) {
  try {
    const { email, password, platform } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, fullName: true, passwordHash: true, isPlatformAdmin: true, status: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // One account, one app: the mobile app is drivers-only and the web
    // dashboard is everyone else. Each client identifies itself via
    // `platform` so this is enforced here — the previous checks lived only
    // in each app's UI *after* a token had already been issued, which didn't
    // actually stop that token from being used.
    const app = platform === "web" || platform === "mobile" ? platform : null;

    if (user.isPlatformAdmin) {
      if (app === "mobile") return res.status(403).json({ error: NOT_A_DRIVER });
      if (user.status !== "active") return res.status(403).json({ error: "This account has been suspended" });
      return res.json(await sessionResponse(prisma, user, null, { app }));
    }

    const all = await membershipsOf(prisma, user.id);
    const active = all.filter((m) => m.status === "active");
    if (!active.length) {
      // On the web: signed in, to a plain "You're not part of any fleet
      // right now" page (they can still accept an invitation or start a
      // fleet). The app just shows the message.
      if (app === "web") return res.json(await sessionResponse(prisma, user, null, { app }));
      return res.status(403).json({ error: NO_FLEET_MESSAGE, code: "no_fleet" });
    }
    const usable = usableMemberships(all, app);
    if (!usable.length) {
      return res.status(403).json({ error: app === "mobile" ? NOT_A_DRIVER : DRIVERS_USE_THE_APP });
    }

    // Block login based on the chosen company's state.
    const chosen = chooseMembership(usable, req.body.companyId);
    const refusal = companyRefusal(chosen.company);
    if (refusal) return refuseCompany(res, chosen.company, refusal);

    return res.json(await sessionResponse(prisma, user, chosen, { app }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
}

// Issues a new access token (and rotates the refresh token) from a valid
// refresh token. Each refresh token is single-use: presenting one a second
// time — which only happens if it was copied/stolen, since the legitimate
// client always swaps it for the newly-issued one — revokes every refresh
// token for that user as a precaution.
//
// It stays in the token's fleet. If that membership was switched off
// meanwhile, it moves to another fleet this app can use (the response's
// `user` says which), or, on the web with none left, a no-fleet session.
export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    if (stored.revoked) {
      await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revoked: false }, data: { revoked: true } });
      return res.status(401).json({ error: "This session has been revoked. Please sign in again." });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(decoded.id) },
      select: { id: true, email: true, fullName: true, isPlatformAdmin: true, status: true },
    });
    if (!user) return res.status(401).json({ error: "Invalid refresh token" });

    const app = decoded.app ?? null;
    let membership = null;
    if (user.isPlatformAdmin && !decoded.companyId) {
      if (user.status && user.status !== "active") {
        return res.status(401).json({ error: "This account has been deactivated", code: "account_inactive" });
      }
    } else {
      const all = await membershipsOf(prisma, user.id);
      const usable = usableMemberships(all, app);
      membership = usable.find((m) => m.companyId === decoded.companyId) ?? chooseMembership(usable);
      const noFleetOnWeb = app === "web" && !all.some((m) => m.status === "active");
      if (!membership && !noFleetOnWeb) {
        return res.status(401).json({ error: NO_FLEET_MESSAGE, code: "account_inactive" });
      }
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    return res.json(await sessionResponse(prisma, user, membership, { app }));
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}

// GET /api/auth/memberships (signed in): the fleets this person can switch
// to in this app, for the fleet switcher.
export async function myMemberships(req, res) {
  try {
    const me = req.identity;
    const list = usableMemberships(await membershipsOf(prisma, me.id), me.app);
    return res.json({
      currentCompanyId: me.companyId,
      isPlatformAdmin: me.isPlatformAdmin,
      memberships: list.map((m) => ({
        companyId: m.companyId,
        companyName: m.company?.name ?? null,
        companyStatus: m.company?.status ?? null,
        role: m.role,
        adminAccess: m.role === "ADMIN" ? m.adminAccess || "full" : null,
        lastUsedAt: m.lastUsedAt ?? null,
        current: m.companyId === me.companyId,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not load your fleets" });
  }
}

// POST /api/auth/switch-fleet { companyId, refreshToken? } (signed in, web or
// app): new tokens running as the person's membership in that fleet. The
// refresh token sent along (the one being replaced) is revoked.
export async function switchFleet(req, res) {
  try {
    const me = req.identity;
    const user = { id: me.id, email: me.email, fullName: me.fullName, isPlatformAdmin: me.isPlatformAdmin };
    const revokeOld = async () => {
      if (typeof req.body?.refreshToken === "string" && req.body.refreshToken) {
        await prisma.refreshToken.updateMany({
          where: { tokenHash: hashToken(req.body.refreshToken), userId: me.id },
          data: { revoked: true },
        });
      }
    };
    // Figbloom staff who own a fleet of their own: back to the staff area.
    if (req.body?.staffArea === true) {
      if (!me.isPlatformAdmin) return res.status(403).json({ error: "Only Figbloom staff have a staff area" });
      await revokeOld();
      return res.json(await sessionResponse(prisma, user, null, { app: me.app }));
    }
    const companyId = String(req.body?.companyId ?? "").trim();
    if (!companyId) return res.status(400).json({ error: "Choose a fleet to switch to" });

    const membership = await prisma.membership.findUnique({
      where: { userId_companyId: { userId: me.id, companyId } },
      include: { company: { select: { id: true, name: true, status: true, subscriptionPlan: true, trialEndsAt: true, createdAt: true } } },
    });
    if (!membership || membership.status !== "active") {
      return res.status(404).json({ code: "not_a_member", error: "You're not part of that fleet any more. Ask its owner if you need access." });
    }
    if (!usableOn(me.app, membership.role)) {
      return res.status(403).json({ code: "wrong_app", error: me.app === "mobile" ? NOT_A_DRIVER : DRIVERS_USE_THE_APP });
    }
    const refusal = companyRefusal(membership.company);
    if (refusal) return refuseCompany(res, membership.company, refusal);

    await revokeOld();
    return res.json(await sessionResponse(prisma, user, membership, { app: me.app }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not switch fleet. Please try again." });
  }
}

// Revokes a single refresh token — called on sign-out so a stolen-but-unused
// token from that session can't be replayed later.
export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(204).send();

    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
    return res.status(204).send();
  } catch (err) {
    // Sign-out should never fail visibly from the client's perspective.
    return res.status(204).send();
  }
}

// Starts a password reset — always responds the same way whether or not the
// email exists, so this endpoint can't be used to check which emails are
// registered.
export async function forgotPassword(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordTokenHash: hashResetToken(token),
          resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const resetLink = `${frontendUrl()}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
      try {
        await sendPasswordResetEmail(email, resetLink);
      } catch (mailErr) {
        // Don't leak whether the account exists via a differing response —
        // just log it server-side so delivery problems are still visible.
        console.error("[password reset] failed to send email:", mailErr);
      }
    }

    return res.json({ message: "If an account exists for that email, a reset link has been generated." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to process the request" });
  }
}

// Completes a password reset from a token issued by forgotPassword.
export async function resetPassword(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "email, token, and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.resetPasswordTokenHash ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires.getTime() < Date.now() ||
      user.resetPasswordTokenHash !== hashResetToken(token)
    ) {
      return res.status(400).json({ error: "This reset link is invalid or has expired" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10), resetPasswordTokenHash: null, resetPasswordExpires: null },
    });

    // The password may have been compromised — invalidate every existing
    // session so a reset also forces re-authentication everywhere.
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });

    return res.json({ message: "Password updated. You can now sign in." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
}
