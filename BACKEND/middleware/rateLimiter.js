import rateLimit from "express-rate-limit";

// Limits login attempts: max 5 tries per 15 minutes, per IP address
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true, // return rate limit info in response headers
  legacyHeaders: false,
});

// Limits password reset requests: max 5 tries per 15 minutes, per IP address
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Too many reset requests. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});










