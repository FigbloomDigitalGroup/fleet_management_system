// "Confirm your email" after signing up with Figbloom sign-in
// (ERP/FLEET_COGNITO_CONTRACT.md section 2). Signing up proves nothing about
// the address, and Cognito's "Forgot password" only sends codes to a verified
// one. The welcome email carries this link; opening it has the platform mark
// the email verified (POST /users/{sub}/email-verified).
//
// The token is signed, not stored: { typ, uid, sub } for 14 days, with a key
// derived from JWT_SECRET for this purpose only, so it can never pass as a
// sign-in token (and a sign-in token never passes as this).
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { frontendUrl } from "./mailer.js";

const TYPE = "confirm_email";
export const CONFIRM_EMAIL_DAYS = 14;

function key() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update("fleet:confirm-email").digest();
}

// user: { id, identitySub }
export function confirmEmailToken(user) {
  return jwt.sign({ typ: TYPE, uid: user.id, sub: user.identitySub }, key(), { expiresIn: `${CONFIRM_EMAIL_DAYS}d`, algorithm: "HS256" });
}

export function confirmEmailLink(user) {
  return `${frontendUrl()}/confirm-email?token=${encodeURIComponent(confirmEmailToken(user))}`;
}

// -> { uid, sub } or null (forged, expired, or another kind of token)
export function readConfirmEmailToken(token) {
  try {
    const decoded = jwt.verify(String(token), key(), { algorithms: ["HS256"] });
    if (decoded?.typ !== TYPE || typeof decoded.uid !== "string" || typeof decoded.sub !== "string") return null;
    return { uid: decoded.uid, sub: decoded.sub };
  } catch {
    return null;
  }
}
