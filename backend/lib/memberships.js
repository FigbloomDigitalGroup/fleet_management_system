// Memberships (FLEET_MEMBERSHIPS_CONTRACT.md): a User is a person's identity
// (one email, one account); each fleet they belong to is a Membership with
// their role there, an ADMIN's access level and whether it is switched on.
// A session runs as one membership at a time ("the active membership":
// req.user.companyId / role / adminAccess come from it, middleware/auth.js).
//
// User.role / User.companyId / User.adminAccess are the old columns, kept for
// one release and never read: everything that asks "who is in this fleet, as
// what" asks Membership.
import { STAFF_ROLES, ROLE_TITLES } from "./staffRoles.js";

export const MEMBER_ROLES = ["COMPANY_OWNER", "ADMIN", ...STAFF_ROLES, "DRIVER"];
export const ADMIN_ACCESS_LEVELS = ["full", "dispatcher", "viewer"];

export const NO_FLEET_MESSAGE = "You're not part of any fleet right now. Ask the fleet owner to add you again.";

// The web app and the driver app say which they are when signing in
// ("web" | "mobile"): drivers use the app, everyone else the web.
export function usableOn(app, role) {
  if (app === "mobile") return role === "DRIVER";
  if (app === "web") return role !== "DRIVER";
  return true;
}

export const adminAccessOf = (m) => (m?.role === "ADMIN" ? m.adminAccess || "full" : null);

// The status word the web and the app have always used for a person.
export const legacyStatus = (status) => (status === "active" ? "active" : "inactive");

// A membership row (with its user) as the person record the API has always
// returned: the user's own fields, with role / companyId / adminAccess /
// status from this fleet's membership, and createdAt = when they joined it.
export function memberAsUser(m) {
  if (!m) return null;
  const { user, company: _company, ...mem } = m;
  return {
    ...(user ?? {}),
    id: mem.userId,
    role: mem.role,
    companyId: mem.companyId,
    adminAccess: adminAccessOf(mem),
    status: legacyStatus(mem.status),
    ...(mem.createdAt ? { createdAt: mem.createdAt } : {}),
    membershipId: mem.id,
  };
}

const userInclude = (user) => (user === true ? true : { select: { id: true, ...user } });

// People in a fleet as person records. `where` is on Membership (companyId,
// role, status, userId...), so tenantScope(req) fits it as it is.
export async function findMembers(db, where, { user = true, orderBy = { createdAt: "desc" } } = {}) {
  const rows = await db.membership.findMany({ where, include: { user: userInclude(user) }, orderBy });
  return rows.map(memberAsUser);
}

export async function findMember(db, where, { user = true } = {}) {
  return memberAsUser(await db.membership.findFirst({ where, include: { user: userInclude(user) } }));
}

// Is the user (any status) a member of the company? -> the membership or null
export function membershipOf(db, userId, companyId) {
  if (!userId || !companyId) return null;
  return db.membership.findUnique({ where: { userId_companyId: { userId: String(userId), companyId: String(companyId) } } });
}

// A company people can work in: active (not pending, suspended or
// rejected) and not past the end of its trial.
export function companyRefusal(company, now = Date.now()) {
  if (!company) return null;
  if (company.status === "suspended") return ["company_suspended", "Your company's account has been suspended. Please contact support."];
  if (company.status === "rejected") return ["company_rejected", "Your company's registration was not approved. Please contact support."];
  if (company.status === "pending") return ["company_pending", "Your company's account is awaiting approval. Please check back soon."];
  if (company.subscriptionPlan === "trial" && company.trialEndsAt && new Date(company.trialEndsAt).getTime() < now) {
    return ["trial_ended", "Your trial period has ended. Please upgrade your plan to continue."];
  }
  return null;
}

const COMPANY_FIELDS = { id: true, name: true, status: true, subscriptionPlan: true, trialEndsAt: true, createdAt: true };

// Every membership of a person with its company, most recently used first
// (then oldest first: the fleet they joined first).
export async function membershipsOf(db, userId) {
  const rows = await db.membership.findMany({ where: { userId: String(userId) }, include: { company: { select: COMPANY_FIELDS } } });
  const t = (d) => (d ? new Date(d).getTime() : -Infinity);
  return rows.sort((a, b) => t(b.lastUsedAt) - t(a.lastUsedAt) || t(a.createdAt) - t(b.createdAt));
}

// The memberships a session on `app` can switch to: switched on and of a
// role that app is for.
export const usableMemberships = (list, app) => list.filter((m) => m.status === "active" && usableOn(app, m.role));

// The fleet to sign into from a list of usable memberships: the one asked
// for, else the most recently used one whose company can be worked in, else
// the most recent one (its company's refusal is then shown).
export function chooseMembership(usable, companyId) {
  if (companyId) {
    const wanted = usable.find((m) => m.companyId === String(companyId));
    if (wanted) return wanted;
  }
  return usable.find((m) => !companyRefusal(m.company)) ?? usable[0] ?? null;
}

// What the fleet switcher shows for one membership.
export function membershipSummary(m, currentCompanyId) {
  return {
    companyId: m.companyId,
    companyName: m.company?.name ?? null,
    companyStatus: m.company?.status ?? null,
    role: m.role,
    roleTitle: ROLE_TITLES[m.role] ?? m.role,
    adminAccess: adminAccessOf(m),
    lastUsedAt: m.lastUsedAt ?? null,
    current: !!currentCompanyId && m.companyId === currentCompanyId,
  };
}

// Team audit log (invited, accepted, revoked, disabled, enabled). Never
// fails the change it records.
export async function teamAudit(db, entry) {
  try {
    await db.teamAuditLog.create({
      data: {
        companyId: String(entry.companyId),
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        targetUserId: entry.targetUserId ?? null,
        email: entry.email ?? null,
        details: entry.details ?? undefined,
      },
    });
  } catch (err) {
    console.error(`[team audit] could not record ${entry.action} in ${entry.companyId}:`, err.message);
  }
}
