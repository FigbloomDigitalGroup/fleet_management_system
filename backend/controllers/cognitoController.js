import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { isUniqueViolation } from "../lib/serialize.js";
import { CognitoError, POOLS, cognito, cognitoSignInEnabled, poolConfig } from "../lib/cognito.js";
import { finishSignIn } from "./authController.js";
import { readConfirmEmailToken } from "../lib/emailConfirm.js";
import { FigbloomAccountError, figbloomAccounts, sendAccountError } from "../lib/figbloomAccounts.js";

// POST /api/auth/cognito/exchange { pool, code, codeVerifier, redirectUri }
// (ERP/FLEET_COGNITO_CONTRACT.md section 2): the web dashboard's callback page
// hands over the code from Figbloom's hosted login. Fleet swaps it for the
// person's ID token, finds (or makes) their Fleet user, and answers exactly
// as POST /api/auth/login does: Fleet's own session, or why not.
//
// customers pool: the person's Figbloom account. Found by identitySub, else by
//   a verified email on a Fleet user not yet linked to any Figbloom account
//   (the sub is then stored), else a new Fleet user with no fleets: they land
//   on "no fleet", where they can start one or accept an invitation. Never a
//   Figbloom-staff session, even for staff (lib/session.js actsAsStaff).
// staff pool: Figbloom staff only. Found by staffIdentitySub, else by verified
//   email on a staff user not yet linked; anyone else is refused.

const USER_FIELDS = { id: true, email: true, fullName: true, isPlatformAdmin: true, status: true, identitySub: true, staffIdentitySub: true };
const MAX = { code: 2048, codeVerifier: 128, redirectUri: 2048 };

function readBody(body) {
  const pool = body?.pool;
  if (!POOLS.includes(pool)) return { error: "pool must be customers or staff" };
  const out = { pool };
  for (const key of ["code", "codeVerifier", "redirectUri"]) {
    const value = body?.[key];
    if (typeof value !== "string" || !value || value.length > MAX[key]) return { error: `${key} is required` };
    out[key] = value;
  }
  // PKCE: 43 to 128 characters of [A-Za-z0-9-._~] (RFC 7636)
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(out.codeVerifier)) return { error: "codeVerifier is not a PKCE verifier" };
  return out;
}

const refuse = (res, status, code, error) => res.status(status).json({ code, error });

async function customerUser(claims) {
  const linked = await prisma.user.findUnique({ where: { identitySub: claims.sub }, select: USER_FIELDS });
  if (linked) return linked;
  if (!claims.email) throw new CognitoError("Your Figbloom account has no email address.", 403, "no_email");

  const byEmail = await prisma.user.findUnique({ where: { email: claims.email }, select: USER_FIELDS });
  if (byEmail) {
    // Someone else's Figbloom account, or an email nobody has proven: never
    // hand over an existing Fleet user on that.
    if (byEmail.identitySub || !claims.emailVerified) {
      throw new CognitoError(
        "A Fleet account already uses this email. Ask Figbloom support to link it to your Figbloom account.",
        409,
        "email_in_use"
      );
    }
    return prisma.user.update({ where: { id: byEmail.id }, data: { identitySub: claims.sub }, select: USER_FIELDS });
  }

  try {
    return await prisma.user.create({
      data: {
        email: claims.email,
        fullName: claims.name || claims.email.split("@")[0],
        identitySub: claims.sub,
        // they sign in through Figbloom; this password is random and never used
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 10),
      },
      select: USER_FIELDS,
    });
  } catch (err) {
    // the same person's first sign-in in two tabs at once
    if (isUniqueViolation(err)) {
      const again = await prisma.user.findUnique({ where: { identitySub: claims.sub }, select: USER_FIELDS });
      if (again) return again;
    }
    throw err;
  }
}

async function staffUser(claims) {
  const linked = await prisma.user.findUnique({ where: { staffIdentitySub: claims.sub }, select: USER_FIELDS });
  if (linked?.isPlatformAdmin) return linked;
  if (!linked && claims.email && claims.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email: claims.email }, select: USER_FIELDS });
    if (byEmail?.isPlatformAdmin && !byEmail.staffIdentitySub) {
      return prisma.user.update({ where: { id: byEmail.id }, data: { staffIdentitySub: claims.sub }, select: USER_FIELDS });
    }
  }
  throw new CognitoError("This Figbloom staff account has no access to Fleet's staff area.", 403, "not_fleet_staff");
}

export async function cognitoExchange(req, res) {
  if (!cognitoSignInEnabled()) return refuse(res, 404, "cognito_off", "Figbloom sign-in isn't switched on here.");
  const input = readBody(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  const config = poolConfig(input.pool);
  if (!config) {
    console.error(`[cognito] the ${input.pool} pool's settings are incomplete`);
    return refuse(res, 503, "cognito_not_configured", "Figbloom sign-in isn't set up here yet.");
  }

  try {
    const claims = await cognito.signIn(config, input);
    const user = input.pool === "staff" ? await staffUser(claims) : await customerUser(claims);
    const { identitySub: _i, staffIdentitySub: _s, ...person } = user;
    return await finishSignIn(res, person, { app: "web", via: input.pool, companyId: req.body.companyId });
  } catch (err) {
    if (err instanceof CognitoError) return refuse(res, err.status, err.code, err.message);
    console.error("[cognito] sign-in failed:", err);
    return res.status(500).json({ error: "Sign-in failed. Please try again." });
  }
}

// POST /api/auth/confirm-email { token }: the "Confirm your email" link from
// the welcome email after signing up (lib/emailConfirm.js). The Figbloom
// account's email becomes verified, so Figbloom's "Forgot password" can
// reach it. Using the link again is harmless.
export async function confirmEmail(req, res) {
  const claims = readConfirmEmailToken(req.body?.token);
  if (!claims) return refuse(res, 400, "confirm_link_invalid", "This link is invalid or has expired. Sign in, and ask Figbloom support to confirm your email.");
  try {
    const user = await prisma.user.findUnique({ where: { id: claims.uid }, select: { email: true, identitySub: true } });
    // the account must still be the one the link was made for
    if (!user || user.identitySub !== claims.sub) {
      return refuse(res, 400, "confirm_link_invalid", "This link is no longer valid for this account.");
    }
    await figbloomAccounts.markEmailVerified(claims.sub);
    return res.json({ confirmed: true, email: user.email });
  } catch (err) {
    if (err instanceof FigbloomAccountError) return sendAccountError(res, err);
    console.error("[confirm email] failed:", err);
    return res.status(500).json({ error: "Could not confirm your email. Please try again." });
  }
}
