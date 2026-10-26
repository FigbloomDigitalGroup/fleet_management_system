import User from "../models/User.js";
import { tenantScope } from "../middleware/auth.js";
import { computeDriverScores } from "../lib/driverScore.js";
import { TRACKING_CONSENT_VERSION } from "./trackingController.js";
import { setImageField } from "./uploadController.js";

const PRIVATE_FIELDS = "-passwordHash -resetPasswordTokenHash -resetPasswordExpires";

// Self-editable profile fields — deliberately excludes identity/account
// fields (email, fullName, role, companyId, status) which aren't meant to
// be changed from this endpoint.
const PROFILE_FIELDS = [
  "phone",
  "dob",
  "nationalId",
  "address",
  "licenseNumber",
  "licenseExpiry",
  "emergencyName",
  "emergencyPhone",
];

// COMPANY_OWNER — list Admins under their own company
// PLATFORM_ADMIN — list all Admins across every company
export async function listAdmins(req, res) {
  try {
    const filter = { role: "ADMIN", ...tenantScope(req) };
    const admins = await User.find(filter).select("-passwordHash").sort({ createdAt: -1 });
    return res.json(admins);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch admins" });
  }
}

// List Drivers under the requester's company (or all, for PLATFORM_ADMIN)
export async function listDrivers(req, res) {
  try {
    const filter = { role: "DRIVER", ...tenantScope(req) };
    const drivers = await User.find(filter).select("-passwordHash").sort({ createdAt: -1 });
    return res.json(drivers);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch drivers" });
  }
}

// ADMIN/COMPANY_OWNER — fetch one driver's full profile (tenant-scoped, so
// a driver outside the requester's own company 404s instead of leaking).
export async function getDriverById(req, res) {
  try {
    const driver = await User.findOne({
      _id: req.params.id,
      role: "DRIVER",
      ...tenantScope(req),
    }).select(PRIVATE_FIELDS);
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    return res.json(driver);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch driver" });
  }
}

// Any authenticated user — read their own profile (used by the mobile app's
// Complete profile screen to prefill previously saved details).
export async function getMyProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select(PRIVATE_FIELDS);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}

// Any authenticated user — update their own extended profile fields.
export async function updateMyProfile(req, res) {
  try {
    const updates = {};
    for (const field of PROFILE_FIELDS) {
      if (field in req.body) updates[field] = req.body[field];
    }
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select(
      PRIVATE_FIELDS
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}

const scoreDays = (req) => Math.min(365, Math.max(7, Number(req.query.days) || 30));

// ADMIN/COMPANY_OWNER — one driver's safety score (see lib/driverScore.js)
export async function getDriverScore(req, res) {
  try {
    const driver = await User.findOne({ _id: req.params.id, role: "DRIVER", ...tenantScope(req) }).select("_id");
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    const scores = await computeDriverScores([driver._id], scoreDays(req));
    return res.json(scores.get(String(driver._id)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to compute driver score" });
  }
}

// ADMIN/COMPANY_OWNER — every driver's score, for comparing and coaching
export async function listDriverScores(req, res) {
  try {
    const drivers = await User.find({ role: "DRIVER", ...tenantScope(req) }).select("fullName email");
    const scores = await computeDriverScores(drivers.map((d) => d._id), scoreDays(req));
    return res.json(
      drivers
        .map((d) => ({ ...scores.get(String(d._id)), fullName: d.fullName, email: d.email }))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to compute driver scores" });
  }
}

// DRIVER — their own score, for the mobile app
export async function getMyScore(req, res) {
  try {
    const scores = await computeDriverScores([req.user.id], scoreDays(req));
    return res.json(scores.get(String(req.user.id)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to compute your score" });
  }
}

// DRIVER — records that they accepted the location-tracking notice shown
// in the app (what's tracked, when, why, and how long it's kept).
export async function acceptTrackingConsent(req, res) {
  try {
    const version = req.body.version;
    if (version !== TRACKING_CONSENT_VERSION) {
      return res.status(400).json({ error: "Please review the latest tracking notice and accept it again" });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { trackingConsent: { acceptedAt: new Date(), version } } },
      { new: true }
    ).select(PRIVATE_FIELDS);
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save consent" });
  }
}

// COMPANY_OWNER — set an admin's access level (full / dispatcher / viewer)
export async function updateAdminAccess(req, res) {
  try {
    const { adminAccess } = req.body;
    if (!["full", "dispatcher", "viewer"].includes(adminAccess)) {
      return res.status(400).json({ error: "adminAccess must be full, dispatcher or viewer" });
    }
    const admin = await User.findOneAndUpdate(
      { _id: req.params.id, role: "ADMIN", ...tenantScope(req) },
      { $set: { adminAccess } },
      { new: true }
    ).select(PRIVATE_FIELDS);
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    return res.json(admin);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update admin access" });
  }
}

// Any company user — set or clear their own profile picture. Body:
// { uploadId } from POST /api/uploads (kind "avatar"), or { uploadId: null }.
export async function updateMyAvatar(req, res) {
  try {
    if (!req.user.companyId) return res.status(400).json({ error: "This account is not linked to a company" });
    if (req.body.uploadId === undefined) return res.status(400).json({ error: "uploadId is required (or null to remove)" });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const error = await setImageField(user, "avatarUploadId", req.body.uploadId, { companyId: req.user.companyId, kind: "avatar" });
    if (error) return res.status(400).json({ error });
    return res.json({ avatarUrl: user.avatarUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update profile picture" });
  }
}

// ADMIN/COMPANY_OWNER — set or clear one of their drivers' profile picture.
export async function updateDriverAvatar(req, res) {
  try {
    if (req.body.uploadId === undefined) return res.status(400).json({ error: "uploadId is required (or null to remove)" });
    const driver = await User.findOne({ _id: req.params.id, role: "DRIVER", ...tenantScope(req) });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    const error = await setImageField(driver, "avatarUploadId", req.body.uploadId, { companyId: driver.companyId, kind: "avatar" });
    if (error) return res.status(400).json({ error });
    return res.json({ avatarUrl: driver.avatarUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update profile picture" });
  }
}
