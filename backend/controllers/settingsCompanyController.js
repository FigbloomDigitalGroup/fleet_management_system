import Company from "../models/Company.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import LocationPing from "../models/LocationPing.js";
import DrivingEvent from "../models/DrivingEvent.js";
import { resolveSettings, invalidateCompanySettings } from "../lib/companySettings.js";
import { ALERT_TYPE_LABELS } from "../lib/alerts.js";

const NUMERIC_LIMITS = {
  speedLimitKph: [20, 200],
  idleMinutes: [1, 240],
  offlineMinutes: [5, 1440],
  lowBatteryPercent: [5, 50],
  harshBrakingKphPerSec: [3, 30],
  harshAccelerationKphPerSec: [3, 30],
};
const ALERT_TYPES = Object.keys(ALERT_TYPE_LABELS);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ADMIN/COMPANY_OWNER — the company's alert, tracking-hours and
// data-retention settings, plus the lists the settings form needs.
export async function getMySettings(req, res) {
  try {
    const company = await Company.findById(req.user.companyId).select("alertSettings trackingHours dataRetentionDays");
    if (!company) return res.status(404).json({ error: "Company not found" });
    const recipients = await User.find({ companyId: req.user.companyId, role: { $in: ["COMPANY_OWNER", "ADMIN"] } }).select(
      "fullName email role"
    );
    return res.json({
      ...resolveSettings(company),
      alertTypes: ALERT_TYPES.map((key) => ({ key, label: ALERT_TYPE_LABELS[key] })),
      possibleRecipients: recipients.map((u) => ({ id: u._id, fullName: u.fullName, email: u.email, role: u.role })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load settings" });
  }
}

// ADMIN (full)/COMPANY_OWNER — partial update; anything omitted is unchanged.
export async function updateMySettings(req, res) {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    const current = resolveSettings(company);
    const { alertSettings = {}, trackingHours = {}, dataRetentionDays } = req.body;

    const nextAlert = { ...current.alertSettings };
    for (const [key, [min, max]] of Object.entries(NUMERIC_LIMITS)) {
      if (!(key in alertSettings)) continue;
      const n = Number(alertSettings[key]);
      if (!Number.isFinite(n) || n < min || n > max) return res.status(400).json({ error: `${key} must be between ${min} and ${max}` });
      nextAlert[key] = n;
    }
    for (const key of ["disabledTypes", "emailTypes"]) {
      if (!(key in alertSettings)) continue;
      if (!Array.isArray(alertSettings[key])) return res.status(400).json({ error: `${key} must be a list` });
      nextAlert[key] = alertSettings[key].filter((t) => ALERT_TYPES.includes(t));
    }
    if ("emailRecipientIds" in alertSettings) {
      const valid = await User.find({
        _id: { $in: (alertSettings.emailRecipientIds || []).filter(Boolean) },
        companyId: company._id,
        role: { $in: ["COMPANY_OWNER", "ADMIN"] },
      }).select("_id");
      nextAlert.emailRecipientIds = valid.map((u) => u._id);
    }

    const nextHours = { ...current.trackingHours };
    if ("enabled" in trackingHours) nextHours.enabled = !!trackingHours.enabled;
    for (const key of ["start", "end"]) {
      if (!(key in trackingHours)) continue;
      if (!HHMM.test(trackingHours[key])) return res.status(400).json({ error: `${key} must be HH:MM (24-hour)` });
      nextHours[key] = trackingHours[key];
    }
    if ("days" in trackingHours) {
      const days = [...new Set((trackingHours.days || []).map(Number).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
      if (!days.length) return res.status(400).json({ error: "Pick at least one tracking day" });
      nextHours.days = days;
    }

    if (dataRetentionDays !== undefined) {
      const n = Number(dataRetentionDays);
      if (!Number.isInteger(n) || n < 30 || n > 3650) return res.status(400).json({ error: "dataRetentionDays must be 30–3650" });
      company.dataRetentionDays = n;
    }

    company.alertSettings = nextAlert;
    company.trackingHours = nextHours;
    await company.save();
    invalidateCompanySettings(company._id);
    return res.json(resolveSettings(company));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save settings" });
  }
}

// Scheduled (index.js) — deletes location history and driving events older
// than each company's retention period.
export async function purgeExpiredLocationData() {
  const companies = await Company.find().select("dataRetentionDays");
  let deleted = 0;
  for (const c of companies) {
    const days = c.dataRetentionDays || 180;
    const cutoff = new Date(Date.now() - days * 86400000);
    const vehicleIds = (await Vehicle.find({ companyId: c._id }).select("_id")).map((v) => v._id);
    if (!vehicleIds.length) continue;
    const [pings, events] = await Promise.all([
      LocationPing.deleteMany({ vehicleId: { $in: vehicleIds }, recordedAt: { $lt: cutoff } }),
      DrivingEvent.deleteMany({ companyId: c._id, recordedAt: { $lt: cutoff } }),
    ]);
    deleted += pings.deletedCount + events.deletedCount;
  }
  return deleted;
}
