import User from "../models/User.js";
import { tenantScope } from "../middleware/auth.js";

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