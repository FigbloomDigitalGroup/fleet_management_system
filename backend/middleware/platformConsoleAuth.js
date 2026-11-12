// Server-to-server auth for the Figbloom console's backend
// (GET /api/platform/companies): the x-platform-secret header must equal
// PLATFORM_CONSOLE_SECRET, compared in constant time. With no secret set,
// every request is refused.
import { secretsMatch } from "../lib/platform/signature.js";

export const MIN_CONSOLE_SECRET_LENGTH = 32;

export function requirePlatformConsoleSecret(req, res, next) {
  const secret = process.env.PLATFORM_CONSOLE_SECRET?.trim();
  if (!secret || secret.length < MIN_CONSOLE_SECRET_LENGTH) {
    console.error(`[platform] PLATFORM_CONSOLE_SECRET is not set (or shorter than ${MIN_CONSOLE_SECRET_LENGTH} characters); console summaries are refused`);
    return res.status(503).json({ error: "Console summaries are not configured", code: "not_configured" });
  }
  const given = req.get("x-platform-secret");
  if (!secretsMatch(typeof given === "string" ? given.trim() : "", secret)) {
    return res.status(401).json({ error: "Missing or wrong x-platform-secret", code: "unauthorized" });
  }
  next();
}
