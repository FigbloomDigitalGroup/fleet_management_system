// Invite by email (FLEET_MEMBERSHIPS_CONTRACT.md section 3): the owner and
// full admins invite someone to their fleet with a role; the person opens
// the emailed link (/invite/<token>) and either signs in with the account
// they already have, or chooses a name, phone and password for a new one.
// Accepting creates their membership (or switches an old one back on) and
// signs them into that fleet.
//
// The token is 32 random bytes, only in the email; Fleet keeps its sha256.
// Single use, 7 days. One open invitation per (company, email): inviting the
// same address again revokes the open one.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { sendInvitationEmail, frontendUrl } from "../lib/mailer.js";
import { ROLE_TITLES, TEAM_ROLES, canManageTeam } from "../lib/staffRoles.js";
import { ADMIN_ACCESS_LEVELS, companyRefusal, teamAudit } from "../lib/memberships.js";
import { hashToken, sessionResponse } from "../lib/session.js";
import { SUPPORT_TOKEN_TYPE } from "../lib/supportSession.js";
import { enqueueStaffSyncSafely } from "../lib/platform/staffEvents.js";

export const INVITE_DAYS = 7;
// The email sender (tests swap it to read the link instead of sending mail).
export const invitationMailer = { send: sendInvitationEmail };
const INVITE_ROLES = [...TEAM_ROLES, "DRIVER"];
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;
const COMPANY_FIELDS = { id: true, name: true, status: true, subscriptionPlan: true, trialEndsAt: true, createdAt: true };

export const newInviteToken = () => crypto.randomBytes(32).toString("base64url");
const inviteLink = (token) => `${frontendUrl()}/invite/${token}`;
const expiry = (now) => new Date(now.getTime() + INVITE_DAYS * 86400000);
const LOST = new Error("invitation no longer open");

// "open" | "used" | "revoked" | "expired"
export function invitationState(inv, now = new Date()) {
  if (inv.acceptedAt) return "used";
  if (inv.revokedAt) return "revoked";
  if (new Date(inv.expiresAt).getTime() <= now.getTime()) return "expired";
  return "open";
}

function managerCompany(req, res) {
  if (req.user.role === "PLATFORM_ADMIN") {
    const companyId = String(req.body?.companyId ?? req.query?.companyId ?? "").trim();
    if (!companyId) {
      res.status(400).json({ error: "companyId is required" });
      return null;
    }
    return companyId;
  }
  if (canManageTeam(req.user) || (req.user.support && req.method === "GET")) return req.user.companyId;
  res.status(403).json({ error: "Only the fleet owner or a full admin can invite people", code: "role_forbidden" });
  return null;
}

function present(inv, now = new Date()) {
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    roleTitle: ROLE_TITLES[inv.role] ?? inv.role,
    adminAccess: inv.role === "ADMIN" ? inv.adminAccess || "full" : null,
    expiresAt: inv.expiresAt,
    lastSentAt: inv.lastSentAt ?? inv.createdAt,
    createdAt: inv.createdAt,
    state: invitationState(inv, now),
  };
}

// Sends (or re-sends) the email. -> true when it went, false when it failed
// (the invitation is kept either way; the Team page offers Resend).
async function emailInvitation(inv, token, { companyName, invitedByName }) {
  try {
    await invitationMailer.send(inv.email, {
      companyName,
      roleTitle: ROLE_TITLES[inv.role] ?? inv.role,
      invitedByName,
      inviteLink: inviteLink(token),
      validDays: INVITE_DAYS,
      isDriver: inv.role === "DRIVER",
    });
    return true;
  } catch (err) {
    console.error(`[invitation] email to ${inv.email} failed:`, err.message);
    return false;
  }
}

const nameOf = async (userId) =>
  userId ? (await prisma.user.findUnique({ where: { id: String(userId) }, select: { fullName: true } }))?.fullName ?? null : null;

// POST /api/invitations { email, role, adminAccess? } (owner, full admins)
export async function createInvitation(req, res) {
  try {
    const companyId = managerCompany(req, res);
    if (!companyId) return;
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const role = req.body?.role;
    if (!EMAIL.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address" });
    if (!INVITE_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${INVITE_ROLES.join(", ")}` });
    const adminAccess = role === "ADMIN" ? (ADMIN_ACCESS_LEVELS.includes(req.body?.adminAccess) ? req.body.adminAccess : "full") : null;

    const company = await prisma.company.findUnique({ where: { id: String(companyId) }, select: { id: true, name: true } });
    if (!company) return res.status(404).json({ error: "Company not found" });

    // Already in this fleet?
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const member = await prisma.membership.findUnique({
        where: { userId_companyId: { userId: existingUser.id, companyId: company.id } },
        select: { status: true },
      });
      if (member?.status === "active") {
        return res.status(409).json({ code: "already_member", error: "This person is already in your fleet." });
      }
      if (member) {
        return res.status(409).json({
          code: "member_disabled",
          error: "This person used to be in your fleet and is switched off. Switch them back on from the Team list instead.",
        });
      }
    }

    const now = new Date();
    const token = newInviteToken();
    const invitation = await prisma.$transaction(async (tx) => {
      // one open invitation per (company, email): inviting again replaces it
      await tx.invitation.updateMany({
        where: { companyId: company.id, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      return tx.invitation.create({
        data: {
          companyId: company.id,
          email,
          role,
          adminAccess,
          tokenHash: hashToken(token),
          expiresAt: expiry(now),
          invitedById: req.user.id,
          lastSentAt: now,
        },
      });
    });
    const emailed = await emailInvitation(invitation, token, { companyName: company.name, invitedByName: await nameOf(req.user.id) });
    await teamAudit(prisma, {
      companyId: company.id,
      actorUserId: req.user.id,
      action: "invited",
      email,
      details: { invitationId: invitation.id, role, adminAccess },
    });
    return res.status(201).json({
      message: emailed ? `Invitation sent to ${email}.` : `Invitation saved, but the email to ${email} didn't go out. Try Resend in a minute.`,
      emailed,
      invitation: present(invitation, now),
    });
  } catch (err) {
    console.error("[invitation] create failed:", err);
    return res.status(500).json({ error: "Could not send the invitation. Please try again." });
  }
}

// GET /api/invitations: the fleet's invitations still waiting (open, and
// expired ones not yet replaced or revoked), newest first.
export async function listInvitations(req, res) {
  try {
    const companyId = managerCompany(req, res);
    if (!companyId) return;
    const rows = await prisma.invitation.findMany({
      where: { companyId: String(companyId), acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    return res.json(rows.map((r) => present(r, now)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not load the invitations" });
  }
}

async function ownInvitation(req, res) {
  const companyId = managerCompany(req, res);
  if (!companyId) return null;
  const inv = await prisma.invitation.findFirst({ where: { id: String(req.params.id), companyId: String(companyId) } });
  if (!inv) {
    res.status(404).json({ error: "Invitation not found" });
    return null;
  }
  return inv;
}

// POST /api/invitations/:id/resend: a new link (the old one stops working),
// valid another 7 days, emailed again. Also renews an expired one.
export async function resendInvitation(req, res) {
  try {
    const inv = await ownInvitation(req, res);
    if (!inv) return;
    if (inv.acceptedAt) return res.status(409).json({ code: "invitation_used", error: "This invitation has already been accepted." });
    if (inv.revokedAt) return res.status(409).json({ code: "invitation_revoked", error: "This invitation was cancelled. Send a new one instead." });
    const now = new Date();
    const token = newInviteToken();
    const updated = await prisma.invitation.update({
      where: { id: inv.id },
      data: { tokenHash: hashToken(token), expiresAt: expiry(now), lastSentAt: now },
    });
    const company = await prisma.company.findUnique({ where: { id: inv.companyId }, select: { name: true } });
    const emailed = await emailInvitation(updated, token, { companyName: company?.name ?? "your fleet", invitedByName: await nameOf(req.user.id) });
    await teamAudit(prisma, { companyId: inv.companyId, actorUserId: req.user.id, action: "invitation_resent", email: inv.email, details: { invitationId: inv.id } });
    return res.json({
      message: emailed ? `Invitation sent again to ${inv.email}.` : `The email to ${inv.email} didn't go out. Try again in a minute.`,
      emailed,
      invitation: present(updated, now),
    });
  } catch (err) {
    console.error("[invitation] resend failed:", err);
    return res.status(500).json({ error: "Could not resend the invitation. Please try again." });
  }
}

// POST /api/invitations/:id/revoke: the link stops working.
export async function revokeInvitation(req, res) {
  try {
    const inv = await ownInvitation(req, res);
    if (!inv) return;
    if (inv.acceptedAt) return res.status(409).json({ code: "invitation_used", error: "This invitation has already been accepted." });
    if (!inv.revokedAt) {
      await prisma.invitation.update({ where: { id: inv.id }, data: { revokedAt: new Date() } });
      await teamAudit(prisma, { companyId: inv.companyId, actorUserId: req.user.id, action: "invitation_revoked", email: inv.email, details: { invitationId: inv.id } });
    }
    return res.json({ message: `The invitation to ${inv.email} has been cancelled.`, id: inv.id });
  } catch (err) {
    console.error("[invitation] revoke failed:", err);
    return res.status(500).json({ error: "Could not cancel the invitation. Please try again." });
  }
}

// ---- The invited person (no fleet session needed)

const findByToken = (token) =>
  prisma.invitation.findUnique({
    where: { tokenHash: hashToken(String(token ?? "")) },
    include: { company: { select: COMPANY_FIELDS } },
  });

const STATE_MESSAGES = {
  used: "This invitation has already been used. If it was you, just sign in.",
  revoked: "This invitation was cancelled by the fleet. Ask them to send you a new one.",
  expired: "This invitation has expired (they last 7 days). Ask the fleet to send you a new one.",
};

function stateRefusal(res, inv) {
  if (!inv) return res.status(404).json({ code: "invitation_invalid", state: "invalid", error: "This invitation link isn't valid. Check you copied the whole link from the email." });
  const state = invitationState(inv);
  if (state === "open") return null;
  return res.status(410).json({ code: `invitation_${state}`, state, companyName: inv.company?.name ?? null, error: STATE_MESSAGES[state] });
}

// GET /api/invitations/token/:token: what the /invite page shows.
export async function viewInvitation(req, res) {
  try {
    const inv = await findByToken(req.params.token);
    const refused = stateRefusal(res, inv);
    if (refused) return refused;
    const account = await prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } });
    return res.json({
      state: "open",
      email: inv.email,
      companyName: inv.company.name,
      role: inv.role,
      roleTitle: ROLE_TITLES[inv.role] ?? inv.role,
      adminAccess: inv.role === "ADMIN" ? inv.adminAccess || "full" : null,
      invitedByName: await nameOf(inv.invitedById),
      expiresAt: inv.expiresAt,
      accountExists: !!account,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not open the invitation. Please try again." });
  }
}

// The signed-in person behind an optional Bearer token, or null.
async function bearerUser(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  let decoded;
  try {
    decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    return { invalid: true };
  }
  if (decoded?.typ === SUPPORT_TOKEN_TYPE) return { invalid: true };
  const user = await prisma.user.findUnique({
    where: { id: String(decoded.id) },
    select: { id: true, email: true, fullName: true, isPlatformAdmin: true },
  });
  return user ? { user } : { invalid: true };
}

/**
 * POST /api/invitations/token/:token/accept
 *   signed in (Bearer) as the invited email          -> joins
 *   not signed in, the email has an account: { password }          -> signs in and joins
 *   not signed in, no account yet: { fullName, phone?, password }  -> account + joins
 * -> 200 with a session in that fleet (as sign-in answers), or for a driver
 *    (the app is theirs) / a fleet not yet approved: { joined: true, ... }
 *    without one.
 */
export async function acceptInvitation(req, res) {
  try {
    const inv = await findByToken(req.params.token);
    const refused = stateRefusal(res, inv);
    if (refused) return refused;

    const signedIn = await bearerUser(req);
    let user;
    let created = false;
    if (signedIn && !signedIn.invalid) {
      if (signedIn.user.email !== inv.email) {
        return res.status(409).json({
          code: "wrong_account",
          error: `You're signed in as ${signedIn.user.email}, but this invitation is for ${inv.email}. Sign out, then open the link again.`,
          signedInAs: signedIn.user.email,
          invitedEmail: inv.email,
        });
      }
      user = signedIn.user;
    } else {
      const password = String(req.body?.password ?? "");
      const existing = await prisma.user.findUnique({
        where: { email: inv.email },
        select: { id: true, email: true, fullName: true, isPlatformAdmin: true, passwordHash: true },
      });
      if (existing) {
        if (!password || !(await bcrypt.compare(password, existing.passwordHash))) {
          return res.status(401).json({ code: "bad_password", error: "That password isn't right. Try again, or use \"Forgot password\" on the sign-in page." });
        }
        const { passwordHash: _h, ...rest } = existing;
        user = rest;
      } else {
        const fullName = String(req.body?.fullName ?? "").trim();
        const phone = String(req.body?.phone ?? "").trim();
        if (!fullName) return res.status(400).json({ error: "Please enter your name" });
        if (fullName.length > 120) return res.status(400).json({ error: "Your name must be 120 characters or fewer" });
        if (phone.length > 40) return res.status(400).json({ error: "That phone number is too long" });
        if (password.length < 8) return res.status(400).json({ error: "Your password must be at least 8 characters" });
        user = { email: inv.email, fullName, phone: phone || null, passwordHash: await bcrypt.hash(password, 10) };
        created = true;
      }
    }
    if (user.isPlatformAdmin) {
      return res.status(409).json({ code: "staff_account", error: "This is a Figbloom staff account. Staff open fleets from the staff area instead." });
    }

    const now = new Date();
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        if (created) {
          const made = await tx.user.create({ data: user });
          user = { id: made.id, email: made.email, fullName: made.fullName, isPlatformAdmin: false };
        }
        // single use: only the first accept that finds it still open wins
        const { count } = await tx.invitation.updateMany({
          where: { id: inv.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now, acceptedById: user.id },
        });
        if (!count) throw LOST; // rolls back a just-created account too
        const key = { userId_companyId: { userId: user.id, companyId: inv.companyId } };
        const existing = await tx.membership.findUnique({ where: key });
        const fields = { role: inv.role, adminAccess: inv.role === "ADMIN" ? inv.adminAccess || "full" : null, status: "active", invitedById: inv.invitedById };
        // an owner stays the owner; anyone else gets the invited role
        const membership = existing
          ? existing.role === "COMPANY_OWNER"
            ? await tx.membership.update({ where: key, data: { status: "active" } })
            : await tx.membership.update({ where: key, data: fields })
          : await tx.membership.create({ data: { userId: user.id, companyId: inv.companyId, ...fields } });
        return { membership };
      });
    } catch (err) {
      if (err === LOST) return stateRefusal(res, await findByToken(req.params.token));
      if (err?.code === "P2002") {
        return res.status(409).json({ code: "account_exists", error: "An account with this email was just created. Sign in, then open the link again." });
      }
      throw err;
    }

    // Figbloom HR: a new (or switched back on) person in this fleet
    await enqueueStaffSyncSafely(prisma, user.id, inv.companyId);
    await teamAudit(prisma, {
      companyId: inv.companyId,
      actorUserId: user.id,
      action: "invitation_accepted",
      targetUserId: user.id,
      email: inv.email,
      details: { invitationId: inv.id, role: result.membership.role, newAccount: created },
    });

    const joined = { joined: true, companyName: inv.company.name, role: result.membership.role, newAccount: created };
    if (result.membership.role === "DRIVER") {
      return res.json({ ...joined, message: `You've joined ${inv.company.name} as a driver. Sign in to the FIGBLOOM FLEET app with ${inv.email}.` });
    }
    if (companyRefusal(inv.company)) {
      return res.json({ ...joined, message: `You've joined ${inv.company.name}. You can open it once the fleet is switched on.` });
    }
    const session = await sessionResponse(prisma, user, { ...result.membership, company: inv.company }, { app: "web", now });
    return res.json({ ...joined, ...session });
  } catch (err) {
    console.error("[invitation] accept failed:", err);
    return res.status(500).json({ error: "Could not accept the invitation. Please try again." });
  }
}
