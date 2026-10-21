import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Company from "../models/Company.js";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import { sendPasswordResetEmail } from "../lib/mailer.js";
import { parseSpreadsheetRows } from "../lib/spreadsheet.js";
import { getPlatformSettings } from "./settingsController.js";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_IMPORT_ROWS = 500;

function generateTempPassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Used for refresh tokens too — same idea, different purpose: we only ever
// keep a hash of the token server-side, never the raw value.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, companyId: user.companyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
  });
}

// Signs a refresh token and records it (as a hash) so it can be rotated,
// revoked, or checked for reuse later.
async function issueRefreshToken(user) {
  const token = signRefreshToken(user);
  const { exp } = jwt.decode(token);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(exp * 1000),
  });
  return token;
}

// Registers a new Vehicle Company + its first user (COMPANY_OWNER)
const INDUSTRIES = [
  "logistics_courier",
  "public_transport",
  "school_transport",
  "construction",
  "taxi_ride_hailing",
  "security_cash_transit",
  "agriculture",
  "government_municipal",
  "oil_gas",
  "rental_car",
  "other",
];

export async function registerCompany(req, res) {
  try {
    const { companyName, ownerName, email, password, industry } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!companyName || !ownerName || !normalizedEmail || !password) {
      return res.status(400).json({ error: "companyName, ownerName, email, and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (industry !== undefined && !INDUSTRIES.includes(industry)) {
      return res.status(400).json({ error: `industry must be one of: ${INDUSTRIES.join(", ")}` });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const slug = companyName.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const settings = await getPlatformSettings();
    const subscriptionPlan = settings.defaultPlan;
    const trialEndsAt =
      subscriptionPlan === "trial" ? new Date(Date.now() + settings.trialDays * 24 * 60 * 60 * 1000) : null;

    const company = await Company.create({
      name: companyName,
      slug,
      status: settings.requireManualApproval ? "pending" : "active",
      industry: industry || "other",
      subscriptionPlan,
      trialEndsAt,
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      fullName: ownerName,
      role: "COMPANY_OWNER",
      companyId: company._id,
    });

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user);

    return res.status(201).json({
      message: "Company and owner account created",
      company,
      user: { id: user._id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to register company" });
  }
}

// Creates an Admin (or Driver) user under the requesting Company Owner's tenant
export async function createUserUnderCompany(req, res) {
  try {
    const { email, password, fullName, role } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const allowedRoles = ["ADMIN", "DRIVER"];
    const adminAccess = ["full", "dispatcher", "viewer"].includes(req.body.adminAccess) ? req.body.adminAccess : "full";

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(", ")}` });
    }
    if (role === "DRIVER" && !["ADMIN", "PLATFORM_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only fleet admins can add drivers" });
    }
    if (!normalizedEmail) {
      return res.status(400).json({ error: "email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "companyId is required" });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      fullName,
      role,
      companyId,
      ...(role === "ADMIN" ? { adminAccess } : {}),
    });

    return res.status(201).json({
      message: `${role} account created`,
      user: { id: user._id, email: user.email, role: user.role, companyId: user.companyId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create user" });
  }
}

// Bulk-creates DRIVER accounts from an uploaded .xlsx/.csv file — same
// validation rules as createUserUnderCompany, applied per row. Expected
// columns (case/spacing-insensitive): fullName, email, password (optional —
// a temporary one is generated and returned if left blank).
export async function bulkImportDrivers(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let rows;
    try {
      rows = await parseSpreadsheetRows(req.file.buffer, req.file.originalname);
    } catch (err) {
      return res.status(400).json({ error: "Could not read that file — make sure it's a valid .xlsx or .csv" });
    }

    if (rows.length === 0) return res.status(400).json({ error: "The file has no data rows" });
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `Too many rows — max ${MAX_IMPORT_ROWS} per import` });
    }

    const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;

    const results = [];
    let createdCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // header is row 1
      const fullName = row.fullname || row.name || "";
      const email = String(row.email || "").trim().toLowerCase();
      let password = row.password ? String(row.password) : "";
      let generatedPassword = null;

      if (!fullName) {
        results.push({ row: rowNumber, email, status: "failed", error: "fullName is required" });
        continue;
      }
      if (!email) {
        results.push({ row: rowNumber, email, status: "failed", error: "email is required" });
        continue;
      }
      if (!password) {
        password = generateTempPassword();
        generatedPassword = password;
      } else if (password.length < 8) {
        results.push({ row: rowNumber, email, status: "failed", error: "password must be at least 8 characters" });
        continue;
      }
      if (!companyId) {
        results.push({ row: rowNumber, email, status: "failed", error: "companyId is required" });
        continue;
      }

      const existing = await User.findOne({ email });
      if (existing) {
        results.push({ row: rowNumber, email, status: "failed", error: "An account with this email already exists" });
        continue;
      }

      try {
        const passwordHash = await bcrypt.hash(password, 10);
        await User.create({ email, passwordHash, fullName, role: "DRIVER", companyId });
        results.push({ row: rowNumber, email, status: "created", generatedPassword });
        createdCount++;
      } catch (err) {
        if (err.code === 11000) {
          results.push({ row: rowNumber, email, status: "failed", error: "An account with this email already exists" });
        } else {
          results.push({ row: rowNumber, email, status: "failed", error: "Could not save this row" });
        }
      }
    }

    return res.status(201).json({ createdCount, failedCount: results.length - createdCount, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to import drivers" });
  }
}

// Login for any role, including Drivers (mobile app)
export async function login(req, res) {
  try {
    const { email, password, platform } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // One account, one app: the mobile app is drivers-only and the web
    // dashboard is everyone else. Each client identifies itself via
    // `platform` so this is enforced here — the previous checks lived only
    // in each app's UI *after* a token had already been issued, which didn't
    // actually stop that token from being used.
    if (platform === "mobile" && user.role !== "DRIVER") {
      return res.status(403).json({
        error: "This account isn't a driver account. Sign in from the FIGBLOOM FLEET web dashboard instead.",
      });
    }
    if (platform === "web" && user.role === "DRIVER") {
      return res.status(403).json({
        error: "Driver accounts sign in from the FIGBLOOM FLEET mobile app, not the web dashboard.",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({ error: "This account has been suspended" });
    }

    // Block login based on the user's company state — status and trial
    // expiry were previously only ever set, never actually checked anywhere.
    if (user.companyId) {
      const company = await Company.findById(user.companyId);
      if (company && company.status === "suspended") {
        return res.status(403).json({
          error: "Your company's account has been suspended. Please contact support.",
        });
      }
      if (company && company.status === "pending") {
        return res.status(403).json({
          error: "Your company's account is awaiting approval. Please check back soon.",
        });
      }
      if (company && company.subscriptionPlan === "trial" && company.trialEndsAt && company.trialEndsAt.getTime() < Date.now()) {
        return res.status(403).json({
          error: "Your trial period has ended. Please upgrade your plan to continue.",
        });
      }
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user);

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        adminAccess: user.role === "ADMIN" ? user.adminAccess || "full" : null,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
}

// Issues a new access token (and rotates the refresh token) from a valid
// refresh token. Each refresh token is single-use: presenting one a second
// time — which only happens if it was copied/stolen, since the legitimate
// client always swaps it for the newly-issued one — revokes every refresh
// token for that user as a precaution.
export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const tokenHash = hashToken(refreshToken);
    const stored = await RefreshToken.findOne({ tokenHash });

    if (!stored) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    if (stored.revoked) {
      await RefreshToken.updateMany({ userId: stored.userId, revoked: false }, { revoked: true });
      return res.status(401).json({ error: "This session has been revoked. Please sign in again." });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "Invalid refresh token" });

    stored.revoked = true;
    await stored.save();

    const accessToken = signAccessToken(user);
    const newRefreshToken = await issueRefreshToken(user);
    return res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}

// Revokes a single refresh token — called on sign-out so a stolen-but-unused
// token from that session can't be replayed later.
export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(204).send();

    const tokenHash = hashToken(refreshToken);
    await RefreshToken.updateOne({ tokenHash }, { revoked: true });
    return res.status(204).send();
  } catch (err) {
    // Sign-out should never fail visibly from the client's perspective.
    return res.status(204).send();
  }
}

// Starts a password reset — always responds the same way whether or not the
// email exists, so this endpoint can't be used to check which emails are
// registered.
export async function forgotPassword(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.resetPasswordTokenHash = hashResetToken(token);
      user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const resetLink = `${frontendUrl}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
      try {
        await sendPasswordResetEmail(email, resetLink);
      } catch (mailErr) {
        // Don't leak whether the account exists via a differing response —
        // just log it server-side so delivery problems are still visible.
        console.error("[password reset] failed to send email:", mailErr);
      }
    }

    return res.json({ message: "If an account exists for that email, a reset link has been generated." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to process the request" });
  }
}

// Completes a password reset from a token issued by forgotPassword.
export async function resetPassword(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "email, token, and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({ email });
    if (
      !user ||
      !user.resetPasswordTokenHash ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires.getTime() < Date.now() ||
      user.resetPasswordTokenHash !== hashResetToken(token)
    ) {
      return res.status(400).json({ error: "This reset link is invalid or has expired" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    // The password may have been compromised — invalidate every existing
    // session so a reset also forces re-authentication everywhere.
    await RefreshToken.updateMany({ userId: user._id, revoked: false }, { revoked: true });

    return res.json({ message: "Password updated. You can now sign in." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
}





