// The Figbloom platform's decision webhook signature (figbloom-platform
// services/platform/src/webhooks.ts, sign / verifySignature):
//
//   x-figbloom-timestamp: <Unix seconds>
//   x-figbloom-signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>">
//
// with the shared secret PLATFORM_WEBHOOK_SECRET. The timestamp must be
// within 5 minutes of now, so a captured request can't be replayed later.
// Verify the raw bytes as received, before parsing them; compared in
// constant time.
import crypto from "crypto";

export const MAX_SKEW_SECONDS = 300;

function hmacHex(secret, message) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

// Constant-time string comparison that also hides the length: both sides are
// hashed first, so timingSafeEqual always compares 32 bytes.
export function secretsMatch(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !given || !expected) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function verifyFigbloomWebhook(secret, rawBody, signature, timestamp, nowMs = Date.now()) {
  if (!secret || typeof rawBody !== "string") return false;
  if (typeof signature !== "string" || typeof timestamp !== "string" || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  return secretsMatch(signature, `sha256=${hmacHex(secret, `${timestamp}.${rawBody}`)}`);
}

// For tests and tooling: the headers the platform would send for this body.
export function signFigbloomWebhook(secret, rawBody, nowMs = Date.now()) {
  const timestamp = String(Math.floor(nowMs / 1000));
  return { timestamp, signature: `sha256=${hmacHex(secret, `${timestamp}.${rawBody}`)}` };
}
