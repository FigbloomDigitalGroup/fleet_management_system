import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Company from "../models/Company.js";
import User from "../models/User.js";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, companyId: user.companyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  });
}

// Registers a new Vehicle Company + its first user (COMPANY_OWNER)
export async function registerCompany(req, res) {
  try {
    const { companyName, ownerName, email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!companyName || !ownerName || !normalizedEmail || !password) {
      return res.status(400).json({ error: "companyName, ownerName, email, and password are required" });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const slug = companyName.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const company = await Company.create({ name: companyName, slug, status: "pending" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      fullName: ownerName,
      role: "COMPANY_OWNER",
      companyId: company._id,
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

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

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(", ")}` });
    }
    if (!normalizedEmail) {
      return res.status(400).json({ error: "email is required" });
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
    const user = await User.create({ email: normalizedEmail, passwordHash, fullName, role, companyId });

    return res.status(201).json({
      message: `${role} account created`,
      user: { id: user._id, email: user.email, role: user.role, companyId: user.companyId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create user" });
  }
}

// Login for any role, including Drivers (mobile app)
export async function login(req, res) {
  try {
    const { email, password } = req.body;
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

    if (user.status !== "active") {
      return res.status(403).json({ error: "This account has been suspended" });
    }

    // Block login if the user's company itself has been suspended
    if (user.companyId) {
      const company = await Company.findById(user.companyId);
      if (company && company.status === "suspended") {
        return res.status(403).json({
          error: "Your company's account has been suspended. Please contact support.",
        });
      }
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
}

// Issues a new access token from a valid refresh token
export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "Invalid refresh token" });

    const accessToken = signAccessToken(user);
    return res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}

// Starts a password reset — always responds the same way whether or not the
// email exists, so this endpoint can't be used to check which emails are
// registered. Email delivery isn't wired up yet, so the reset link is only
// logged server-side for now; a verify-by-email step will replace this log.
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
      console.log(`[password reset] ${email} -> ${resetLink}`);
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

    return res.json({ message: "Password updated. You can now sign in." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
}





