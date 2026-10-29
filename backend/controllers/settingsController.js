import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";

const VEHICLE_LIMIT_DEFAULTS = { trial: 3, basic: 15, pro: 50, enterprise: 999 };

// Gets the single settings row, creating it with defaults if it doesn't
// exist yet. Exported so other controllers (registerCompany, vehicle limit
// enforcement) read the same live settings a platform admin configures here,
// instead of each hardcoding its own defaults.
export async function getPlatformSettings() {
  let settings = await prisma.platformSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!settings) {
    settings = await prisma.platformSettings.create({ data: {} });
  }
  return { ...settings, vehicleLimits: { ...VEHICLE_LIMIT_DEFAULTS, ...(settings.vehicleLimits ?? {}) } };
}

export async function getSettings(req, res) {
  try {
    const settings = await getPlatformSettings();
    return res.json(toApi(settings));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
}

export async function updateSettings(req, res) {
  try {
    const settings = await getPlatformSettings();

    const { requireManualApproval, defaultPlan, trialDays, vehicleLimits, supportEmail } = req.body;
    const data = {};
    if (requireManualApproval !== undefined) data.requireManualApproval = requireManualApproval;
    if (defaultPlan !== undefined) data.defaultPlan = defaultPlan;
    if (trialDays !== undefined) data.trialDays = trialDays;
    if (vehicleLimits !== undefined) data.vehicleLimits = { ...settings.vehicleLimits, ...vehicleLimits };
    if (supportEmail !== undefined) data.supportEmail = supportEmail;

    const updated = await prisma.platformSettings.update({ where: { id: settings.id }, data });
    return res.json(toApi(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update settings" });
  }
}
