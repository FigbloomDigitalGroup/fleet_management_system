import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { computeDriverScores } from "../lib/driverScore.js";
import { TRACKING_CONSENT_VERSION } from "./trackingController.js";
import { setImageField } from "./uploadController.js";

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
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", ...tenantScope(req) },
      orderBy: { createdAt: "desc" },
    });
    return res.json(toApi(admins));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch admins" });
  }
}

// List Drivers under the requester's company (or all, for PLATFORM_ADMIN)
export async function listDrivers(req, res) {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: "DRIVER", ...tenantScope(req) },
      orderBy: { createdAt: "desc" },
    });
    return res.json(toApi(drivers));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch drivers" });
  }
}

// ADMIN/COMPANY_OWNER — fetch one driver's full profile (tenant-scoped, so
// a driver outside the requester's own company 404s instead of leaking).
export async function getDriverById(req, res) {
  try {
    const driver = await prisma.user.findFirst({
      where: { id: req.params.id, role: "DRIVER", ...tenantScope(req) },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    return res.json(toApi(driver));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch driver" });
  }
}

// Any authenticated user — read their own profile (used by the mobile app's
// Complete profile screen to prefill previously saved details).
export async function getMyProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(toApi(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}

// Any authenticated user — update their own extended profile fields.
export async function updateMyProfile(req, res) {
  try {
    const data = {};
    for (const field of PROFILE_FIELDS) {
      if (field in req.body) data[field] = req.body[field] == null ? null : String(req.body[field]);
    }
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    return res.json(toApi(user));
  } catch (err) {
    if (err?.code === "P2025") return res.status(404).json({ error: "User not found" });
    console.error(err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}

const scoreDays = (req) => Math.min(365, Math.max(7, Number(req.query.days) || 30));

// ADMIN/COMPANY_OWNER — one driver's safety score (see lib/driverScore.js)
export async function getDriverScore(req, res) {
  try {
    const driver = await prisma.user.findFirst({
      where: { id: req.params.id, role: "DRIVER", ...tenantScope(req) },
      select: { id: true },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    const scores = await computeDriverScores([driver.id], scoreDays(req));
    return res.json(scores.get(driver.id));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to compute driver score" });
  }
}

// ADMIN/COMPANY_OWNER — every driver's score, for comparing and coaching
export async function listDriverScores(req, res) {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: "DRIVER", ...tenantScope(req) },
      select: { id: true, fullName: true, email: true },
    });
    const scores = await computeDriverScores(drivers.map((d) => d.id), scoreDays(req));
    return res.json(
      drivers
        .map((d) => ({ ...scores.get(d.id), fullName: d.fullName, email: d.email }))
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
    return res.json(scores.get(req.user.id));
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
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { consentAcceptedAt: new Date(), consentVersion: version },
    });
    return res.json(toApi(user));
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
    const admin = await prisma.user.findFirst({
      where: { id: req.params.id, role: "ADMIN", ...tenantScope(req) },
      select: { id: true },
    });
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    const updated = await prisma.user.update({ where: { id: admin.id }, data: { adminAccess } });
    return res.json(toApi(updated));
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
    const { error, url } = await setImageField("user", req.user.id, "avatarUploadId", req.body.uploadId, {
      companyId: req.user.companyId,
      kind: "avatar",
    });
    if (error) return res.status(400).json({ error });
    return res.json({ avatarUrl: url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update profile picture" });
  }
}

// ADMIN/COMPANY_OWNER — set or clear one of their drivers' profile picture.
export async function updateDriverAvatar(req, res) {
  try {
    if (req.body.uploadId === undefined) return res.status(400).json({ error: "uploadId is required (or null to remove)" });
    const driver = await prisma.user.findFirst({
      where: { id: req.params.id, role: "DRIVER", ...tenantScope(req) },
      select: { id: true, companyId: true },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    const { error, url } = await setImageField("user", driver.id, "avatarUploadId", req.body.uploadId, {
      companyId: driver.companyId,
      kind: "avatar",
    });
    if (error) return res.status(400).json({ error });
    return res.json({ avatarUrl: url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update profile picture" });
  }
}
