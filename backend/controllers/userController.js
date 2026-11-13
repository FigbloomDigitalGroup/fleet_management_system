import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";
import { computeDriverScores } from "../lib/driverScore.js";
import { TRACKING_CONSENT_VERSION } from "./trackingController.js";
import { setImageField } from "./uploadController.js";
import { TEAM_ROLES, canManageTeam } from "../lib/staffRoles.js";
import { enqueueStaffSyncSafely } from "../lib/platform/staffEvents.js";
import { findMember, findMembers, teamAudit } from "../lib/memberships.js";

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

// People are found through their membership in the requester's company
// (lib/memberships.js): role, adminAccess and status are that fleet's.

// COMPANY_OWNER — list Admins under their own company
// PLATFORM_ADMIN — list all Admins across every company
export async function listAdmins(req, res) {
  try {
    const admins = await findMembers(prisma, { role: "ADMIN", ...tenantScope(req) });
    return res.json(toApi(admins));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch admins" });
  }
}

// List Drivers under the requester's company (or all, for PLATFORM_ADMIN)
export async function listDrivers(req, res) {
  try {
    const drivers = await findMembers(prisma, { role: "DRIVER", ...tenantScope(req) });
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
    const driver = await findMember(prisma, { userId: String(req.params.id), role: "DRIVER", ...tenantScope(req) });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    return res.json(toApi(driver));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch driver" });
  }
}

// The signed-in person's own record: their profile, with role, companyId,
// adminAccess and status from the fleet the session runs as.
function asMe(req, user) {
  if (!user) return null;
  const { isPlatformAdmin: _p, identitySub: _s, ...rest } = user;
  return {
    ...rest,
    role: req.user.role,
    companyId: req.user.companyId,
    adminAccess: req.user.adminAccess ?? null,
    status: "active",
  };
}

// Any authenticated user — read their own profile (used by the mobile app's
// Complete profile screen to prefill previously saved details).
export async function getMyProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(toApi(asMe(req, user)));
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
    // a new phone number goes to Figbloom HR, in every fleet they are in
    if ("phone" in data) {
      const fleets = await prisma.membership.findMany({ where: { userId: user.id, status: "active" }, select: { companyId: true } });
      for (const { companyId } of fleets) await enqueueStaffSyncSafely(prisma, user.id, companyId);
    }
    return res.json(toApi(asMe(req, user)));
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
    const driver = await findMember(prisma, { userId: String(req.params.id), role: "DRIVER", ...tenantScope(req) }, { user: {} });
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
    const drivers = await findMembers(prisma, { role: "DRIVER", ...tenantScope(req) }, { user: { fullName: true, email: true } });
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
    return res.json(toApi(asMe(req, user)));
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
    const admin = await findMember(prisma, { userId: String(req.params.id), role: "ADMIN", ...tenantScope(req) }, { user: {} });
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    await prisma.membership.update({ where: { id: admin.membershipId }, data: { adminAccess } });
    return res.json(toApi(await findMember(prisma, { id: admin.membershipId })));
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
    const driver = await findMember(prisma, { userId: String(req.params.id), role: "DRIVER", ...tenantScope(req) }, { user: {} });
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

// ---- Settings -> Team (FLEET_HR_CONTRACT.md section 0): the owner and full
// admins manage the company's team (full/dispatcher/viewer admins and the
// staff roles) and switch people, drivers included, off and on again.

// The person's own fields a team row shows (role, access, status: the membership's).
const TEAM_FIELDS = { email: true, fullName: true, phone: true, avatarUploadId: true };

function teamManager(req, res) {
  if (req.user.role === "PLATFORM_ADMIN" || canManageTeam(req.user)) return true;
  res.status(403).json({ error: "Only the fleet owner or a full admin can manage the team", code: "role_forbidden" });
  return false;
}

// GET /api/users/team: everyone on the team (not drivers), active or not.
export async function listTeam(req, res) {
  try {
    // Figbloom staff in a support view (as the owner) see it read-only.
    if (!(req.user.role === "COMPANY_OWNER" && req.user.support) && !teamManager(req, res)) return;
    const team = await findMembers(prisma, { role: { in: TEAM_ROLES }, ...tenantScope(req) }, { user: TEAM_FIELDS });
    return res.json(toApi(team));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch the team" });
  }
}

// PATCH /api/users/team/:id { role, adminAccess? }: change a team member's
// role (ADMIN with an access level, or a staff role). Never the owner or a driver.
export async function updateTeamMember(req, res) {
  try {
    if (!teamManager(req, res)) return;
    const { role } = req.body;
    if (!TEAM_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${TEAM_ROLES.join(", ")}` });
    const adminAccess = role === "ADMIN" ? (["full", "dispatcher", "viewer"].includes(req.body.adminAccess) ? req.body.adminAccess : "full") : null;
    const member = await findMember(prisma, { userId: String(req.params.id), role: { in: TEAM_ROLES }, ...tenantScope(req) }, { user: {} });
    if (!member) return res.status(404).json({ error: "Team member not found" });
    if (member.id === req.user.id) return res.status(400).json({ error: "You can't change your own role" });
    await prisma.membership.update({ where: { id: member.membershipId }, data: { role, adminAccess } });
    if (member.role !== role) await enqueueStaffSyncSafely(prisma, member.id, member.companyId);
    return res.json(toApi(await findMember(prisma, { id: member.membershipId }, { user: TEAM_FIELDS })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update the team member" });
  }
}

// PATCH /api/users/:id/status { status: "active" | "inactive" }: switch a
// team member's or driver's membership in this fleet off (signed out of this
// fleet at their next request, told to Figbloom HR as fleet.staff.left) or
// back on. Their other fleets are not affected; their sign-in sessions are
// ended only when this was their last fleet. Never the owner or yourself
// ("disabled" is accepted as well as "inactive").
export async function setPersonStatus(req, res) {
  try {
    if (!teamManager(req, res)) return;
    const status = req.body.status === "disabled" ? "inactive" : req.body.status;
    if (!["active", "inactive"].includes(status)) return res.status(400).json({ error: "status must be active or inactive" });
    const person = await findMember(prisma, { userId: String(req.params.id), role: { in: [...TEAM_ROLES, "DRIVER"] }, ...tenantScope(req) }, { user: { email: true } });
    if (!person) return res.status(404).json({ error: "Person not found" });
    if (person.id === req.user.id) return res.status(400).json({ error: "You can't switch off your own account" });
    if (person.status === status) return res.json({ id: person.id, status });
    await prisma.membership.update({ where: { id: person.membershipId }, data: { status: status === "active" ? "active" : "disabled" } });
    if (status === "inactive") {
      const otherFleets = await prisma.membership.count({ where: { userId: person.id, status: "active" } });
      if (!otherFleets) await prisma.refreshToken.updateMany({ where: { userId: person.id, revoked: false }, data: { revoked: true } });
    }
    await enqueueStaffSyncSafely(prisma, person.id, person.companyId);
    await teamAudit(prisma, {
      companyId: person.companyId,
      actorUserId: req.user.support ? null : req.user.id,
      action: status === "active" ? "membership_enabled" : "membership_disabled",
      targetUserId: person.id,
      email: person.email,
      details: { role: person.role },
    });
    return res.json({ id: person.id, status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update the account" });
  }
}
