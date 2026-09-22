import PlatformSettings from "../models/PlatformSettings.js";

// Gets the single settings document, creating it with defaults if it doesn't exist yet
async function getOrCreateSettings() {
  let settings = await PlatformSettings.findOne();
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  return settings;
}

export async function getSettings(req, res) {
  try {
    const settings = await getOrCreateSettings();
    return res.json(settings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
}

export async function updateSettings(req, res) {
  try {
    const settings = await getOrCreateSettings();

    const { requireManualApproval, defaultPlan, trialDays, vehicleLimits, supportEmail } = req.body;

    if (requireManualApproval !== undefined) settings.requireManualApproval = requireManualApproval;
    if (defaultPlan !== undefined) settings.defaultPlan = defaultPlan;
    if (trialDays !== undefined) settings.trialDays = trialDays;
    if (vehicleLimits !== undefined) settings.vehicleLimits = { ...settings.vehicleLimits, ...vehicleLimits };
    if (supportEmail !== undefined) settings.supportEmail = supportEmail;

    await settings.save();
    return res.json(settings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update settings" });
  }
}