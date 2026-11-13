// Sign-in sessions (FLEET_MEMBERSHIPS_CONTRACT.md section 2). A session is
// a person (User.id) running as one membership: the access token carries
// the user id, the active membership (companyId, role, adminAccess),
// isPlatformAdmin and which app it is for ("web" | "mobile"). The refresh
// token carries the user id, the company and the app, so refreshing stays
// in the same fleet. Every request re-reads the membership (resolveAccess).
//
// Three kinds of session:
// - a membership: companyId set;
// - Figbloom staff (isPlatformAdmin): role PLATFORM_ADMIN, companyId null;
// - no fleet (web only): someone whose memberships are all switched off or
//   removed. companyId and role null; the web app shows "You're not part of
//   any fleet right now" and they can still accept an invitation or start a
//   new fleet. Every fleet API refuses it (no_fleet).
//
// Tokens issued before memberships carry { id, role, companyId }: the
// company is still in them, so they keep working until they expire.
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { adminAccessOf, chooseMembership, membershipSummary, membershipsOf, usableMemberships, NO_FLEET_MESSAGE } from "./memberships.js";

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const appClaim = (app) => (app === "web" || app === "mobile" ? { app } : {});

// session: { companyId, role, adminAccess, isPlatformAdmin, app }
export function signAccessToken(userId, session) {
  return jwt.sign(
    {
      id: userId,
      role: session.role ?? null,
      companyId: session.companyId ?? null,
      adminAccess: session.adminAccess ?? null,
      isPlatformAdmin: !!session.isPlatformAdmin,
      ...appClaim(session.app),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

// The random jwtid makes every token unique — without it, two tokens issued
// to the same user within one second were identical and clashed on tokenHash.
function signRefreshToken(userId, session) {
  return jwt.sign({ id: userId, companyId: session.companyId ?? null, ...appClaim(session.app) }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
    jwtid: crypto.randomUUID(),
  });
}

// Signs a refresh token and records it (as a hash) so it can be rotated,
// revoked, or checked for reuse later.
export async function issueRefreshToken(db, userId, session) {
  const token = signRefreshToken(userId, session);
  const { exp } = jwt.decode(token);
  await db.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(exp * 1000) },
  });
  return token;
}

/**
 * New tokens for `user` running as `membership` (null: Figbloom staff, or a
 * no-fleet web session) and the sign-in response: the same `user` fields as
 * before memberships, plus `memberships` (the fleets this app can switch to).
 * user: { id, email, fullName, isPlatformAdmin }
 */
export async function sessionResponse(db, user, membership, { app = null, now = new Date() } = {}) {
  if (membership) {
    await db.membership.update({ where: { id: membership.id }, data: { lastUsedAt: now } });
  }
  const session = membership
    ? { companyId: membership.companyId, role: membership.role, adminAccess: adminAccessOf(membership) }
    : user.isPlatformAdmin
      ? { companyId: null, role: "PLATFORM_ADMIN", adminAccess: null }
      : { companyId: null, role: null, adminAccess: null };
  const full = { ...session, isPlatformAdmin: !!user.isPlatformAdmin, app };
  const accessToken = signAccessToken(user.id, full);
  const refreshToken = await issueRefreshToken(db, user.id, full);
  const memberships = usableMemberships(await membershipsOf(db, user.id), app);
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: session.role,
      companyId: session.companyId,
      adminAccess: session.adminAccess,
      isPlatformAdmin: !!user.isPlatformAdmin,
      ...(membership?.company?.name ? { companyName: membership.company.name } : {}),
    },
    memberships: memberships.map((m) => membershipSummary(m, session.companyId)),
    accessToken,
    refreshToken,
  };
}

const failure = (status, error, code) => ({ failure: { status, body: code ? { error, code } : { error } } });

/**
 * From a verified access token's payload to what the request runs as:
 *   { user: req.user }            a membership or Figbloom staff
 *   { noFleet: true, identity }   a no-fleet session (identity only)
 *   { failure: { status, body } }
 */
export async function resolveAccess(db, decoded) {
  const user = await db.user.findUnique({
    where: { id: String(decoded.id) },
    select: { id: true, isPlatformAdmin: true, status: true },
  });
  if (!user) return failure(401, "User account no longer exists");

  const wanted = decoded.companyId;
  // companyId null: Figbloom staff, or a no-fleet session. Absent (a token
  // without the claim): the most recently used fleet, as a refresh would pick.
  if (wanted === null || (wanted === undefined && user.isPlatformAdmin)) {
    if (user.isPlatformAdmin) {
      if (user.status && user.status !== "active") return failure(401, "This account has been deactivated", "account_inactive");
      return { user: { id: user.id, role: "PLATFORM_ADMIN", companyId: null, adminAccess: null, isPlatformAdmin: true, app: decoded.app ?? null } };
    }
    return { noFleet: true, identity: { id: user.id } };
  }

  let membership;
  if (wanted) {
    membership = await db.membership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: String(wanted) } },
      select: { id: true, companyId: true, role: true, adminAccess: true, status: true },
    });
  } else {
    membership = chooseMembership(usableMemberships(await membershipsOf(db, user.id), decoded.app));
  }
  // Switched off in this fleet (by the owner, or an exit in Figbloom HR):
  // signed out of it at the next request, not at token expiry.
  if (!membership || membership.status !== "active") {
    return failure(401, "Your access to this fleet has been switched off", "account_inactive");
  }
  return {
    user: {
      id: user.id,
      role: membership.role,
      companyId: membership.companyId,
      adminAccess: adminAccessOf(membership),
      isPlatformAdmin: !!user.isPlatformAdmin,
      app: decoded.app ?? null,
    },
  };
}

export { NO_FLEET_MESSAGE };
