// Support view: a Figbloom staff member (PLATFORM_ADMIN) sees one company's
// owner area (/company/...) exactly as its owner would, but read-only.
//
// Starting one (POST /api/support/sessions) writes a SupportSession row and a
// StaffAuditLog row and returns a short-lived token signed with JWT_SECRET
// that names the row: { typ: "support", sid, staffId, companyId }. On every
// request authenticate() (middleware/auth.js) re-reads the row and only
// honours the token while
// - the row exists, is for the same staff member and company, has not been
//   ended and is not past its expiresAt (the JWT's own exp says the same),
// - the staff member still exists, is still PLATFORM_ADMIN and active,
// - the company still exists.
// The request then runs as that company's owner (role COMPANY_OWNER,
// companyId of the company), so every controller scopes it exactly as it
// scopes the owner, and supportModeDenial() refuses anything but reads, and
// billing altogether. Ending it (or starting another) closes the row and
// writes another audit row.
import jwt from "jsonwebtoken";

export const SUPPORT_TOKEN_TYPE = "support";

const READ_METHODS = ["GET", "HEAD", "OPTIONS"];
// Never readable in a support view, even with GET: payment records and
// checkout verification (which also writes), and platform settings.
const BLOCKED_PREFIXES = ["/api/billing", "/api/settings"];

export const READ_ONLY_MESSAGE = "Read-only support view: Figbloom staff can't change a customer's fleet.";

export function supportSessionMinutes(env = process.env) {
  const n = Number.parseInt(env.SUPPORT_SESSION_MINUTES ?? "", 10);
  return Number.isFinite(n) && n > 0 && n <= 8 * 60 ? n : 60;
}

// The 403 reason for a request in a support view, or null when it may run.
export function supportModeDenial(req) {
  const path = req.originalUrl.split("?")[0];
  if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return "Billing and payment details aren't shown in a support view.";
  }
  if (!READ_METHODS.includes(req.method)) return READ_ONLY_MESSAGE;
  return null;
}

async function audit(db, { staff, action, companyId, sessionId = null, details = null, now }) {
  await db.staffAuditLog.create({
    data: { staffUserId: staff.id, staffEmail: staff.email, action, companyId: String(companyId), sessionId, details, createdAt: now },
  });
}

async function closeSession(db, staff, session, reason, now) {
  await db.supportSession.update({ where: { id: session.id }, data: { endedAt: now, endReason: reason } });
  await audit(db, {
    staff,
    action: "support_view_ended",
    companyId: session.companyId,
    sessionId: session.id,
    details: { reason, startedAt: session.startedAt },
    now,
  });
}

// Starts a support view of companyId for staff ({ id, email, role }).
// Returns null when there is no such company. Any support view this staff
// member still has open is ended first ("replaced"), so one person has at
// most one at a time.
export async function startSupportSession(db, { staff, companyId, ip = null, userAgent = null, now = new Date(), env = process.env }) {
  const company = await db.company.findUnique({ where: { id: String(companyId) }, select: { id: true, name: true, status: true } });
  if (!company) return null;

  const open = await db.supportSession.findMany({ where: { staffUserId: staff.id, endedAt: null } });
  for (const session of open) await closeSession(db, staff, session, "replaced", now);

  const minutes = supportSessionMinutes(env);
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);
  const session = await db.supportSession.create({
    data: {
      staffUserId: staff.id,
      companyId: company.id,
      startedAt: now,
      expiresAt,
      ip: ip ? String(ip).slice(0, 100) : null,
      userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
    },
  });
  await audit(db, {
    staff,
    action: "support_view_started",
    companyId: company.id,
    sessionId: session.id,
    details: { companyName: company.name, expiresAt: expiresAt.toISOString(), ip: session.ip },
    now,
  });

  const token = jwt.sign(
    { typ: SUPPORT_TOKEN_TYPE, sid: session.id, staffId: staff.id, companyId: company.id },
    env.JWT_SECRET,
    { expiresIn: minutes * 60 }
  );
  return { token, session, company };
}

// Ends one of staff's own support views. null when it isn't theirs;
// already-ended ones are returned unchanged (exit is safe to repeat).
export async function endSupportSession(db, { staff, sessionId, now = new Date() }) {
  const session = await db.supportSession.findUnique({ where: { id: String(sessionId) } });
  if (!session || session.staffUserId !== staff.id) return null;
  if (session.endedAt) return session;
  await closeSession(db, staff, session, "exit", now);
  return { ...session, endedAt: now, endReason: "exit" };
}

// From a verified support token's payload to the req.user the request runs
// as, or null when the view is no longer valid (see the top of this file).
export async function resolveSupportSession(db, decoded, now = new Date()) {
  if (!decoded?.sid || !decoded.staffId || !decoded.companyId) return null;
  const session = await db.supportSession.findUnique({ where: { id: String(decoded.sid) } });
  if (
    !session ||
    session.staffUserId !== decoded.staffId ||
    session.companyId !== decoded.companyId ||
    session.endedAt ||
    new Date(session.expiresAt).getTime() <= now.getTime()
  ) {
    return null;
  }
  const staff = await db.user.findUnique({ where: { id: session.staffUserId }, select: { id: true, role: true, status: true } });
  if (!staff || staff.role !== "PLATFORM_ADMIN" || staff.status !== "active") return null;
  const company = await db.company.findUnique({ where: { id: session.companyId }, select: { id: true } });
  if (!company) return null;

  return {
    id: staff.id,
    role: "COMPANY_OWNER",
    companyId: company.id,
    adminAccess: null,
    support: { sessionId: session.id, staffUserId: staff.id, expiresAt: session.expiresAt },
  };
}
