import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Failed logins for one account from one address: max 5 per 15 minutes.
// Keyed on email + IP (not IP alone) so one person mistyping their password
// can't lock out everyone else behind the same address — every mobile user
// arrives through the same tunnel, and offices share one public IP.
// Successful logins don't count.
const accountLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || "").trim().toLowerCase()}`,
  message: { error: "Too many failed login attempts for this account. Please try again in 15 minutes." },
  standardHeaders: true, // return rate limit info in response headers
  legacyHeaders: false,
});

// Backstop against one address guessing passwords across many accounts:
// max 50 failed logins per 15 minutes per IP, generous enough for a shared
// office or tunnel.
const addressLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skipSuccessfulRequests: true,
  message: { error: "Too many failed login attempts from this network. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = [addressLoginLimiter, accountLoginLimiter];

// Limits password reset requests: max 5 tries per 15 minutes, per IP address
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Too many reset requests. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limits attempts to complete a password reset (guards against reset-token
// guessing): max 10 tries per 15 minutes, per IP address
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limits new company/account registrations: max 10 per hour, per IP address
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});










