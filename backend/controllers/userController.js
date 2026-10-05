import User from "../models/User.js";
import { tenantScope } from "../middleware/auth.js";

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






