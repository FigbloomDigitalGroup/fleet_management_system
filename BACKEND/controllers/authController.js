import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Company from "../models/Company.js";
import User from "../models/User.js";

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
        const allowedRoles = ["ADMIN", "DRIVER"];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(", ")}` });
        }

        const companyId = req.user.role === "PLATFORM_ADMIN" ? req.body.companyId : req.user.companyId;
        if (!companyId) {
            return res.status(400).json({ error: "companyId is required" });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ error: "An account with this email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ email, passwordHash, fullName, role, companyId });

        return res.status(201).json({
            message: `${role} account created`,
            user: { id: user._id, email: user.email, role: user.role, companyId: user.companyId },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to create user" });
    }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email });
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

    if (user.role === "DRIVER") {
      return res.status(403).json({ error: "Driver sign-in is available in the mobile app, coming soon." });
    }

    // NEW: block login if the user's company itself has been suspended
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