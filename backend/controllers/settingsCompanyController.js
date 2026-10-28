import prisma from "../lib/prisma.js";
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
    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId ?? "" },
      select: { alertSettings: true, trackingHours: true, dataRetentionDays: true },
    });
    if (!company) return res.status(404).json({ error: "Company not found" });
    const recipients = await prisma.user.findMany({
      where: { companyId: req.user.companyId, role: { in: ["COMPANY_OWNER", "ADMIN"] } },
      select: { id: true, fullName: true, email: true, role: true },
    });
    return res.json({
      ...resolveSettings(company),
      alertTypes: ALERT_TYPES.map((key) => ({ key, label: ALERT_TYPE_LABELS[key] })),
      possibleRecipients: recipients.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load settings" });
  }
}

// ADMIN (full)/COMPANY_OWNER — partial update; anything omitted is unchanged.
export async function updateMySettings(req, res) {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.user.companyId ?? "" } });
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
      const valid = await prisma.user.findMany({
        where: {
          id: { in: (alertSettings.emailRecipientIds || []).filter(Boolean).map(String) },
          companyId: company.id,
          role: { in: ["COMPANY_OWNER", "ADMIN"] },
        },
        select: { id: true },
      });
      nextAlert.emailRecipientIds = valid.map((u) => u.id);
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

    const data = { alertSettings: nextAlert, trackingHours: nextHours };
    if (dataRetentionDays !== undefined) {
      const n = Number(dataRetentionDays);
      if (!Number.isInteger(n) || n < 30 || n > 3650) return res.status(400).json({ error: "dataRetentionDays must be 30–3650" });
      data.dataRetentionDays = n;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data });
    invalidateCompanySettings(company.id);
    return res.json(resolveSettings(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save settings" });
  }
}

// Scheduled (index.js) — deletes location history and driving events older
// than each company's retention period.
export async function purgeExpiredLocationData() {
  const companies = await prisma.company.findMany({ select: { id: true, dataRetentionDays: true } });
  let deleted = 0;
  for (const c of companies) {
    const days = c.dataRetentionDays || 180;
    const cutoff = new Date(Date.now() - days * 86400000);
    const [pings, events] = await Promise.all([
      prisma.locationPing.deleteMany({ where: { vehicle: { companyId: c.id }, recordedAt: { lt: cutoff } } }),
      prisma.drivingEvent.deleteMany({ where: { companyId: c.id, recordedAt: { lt: cutoff } } }),
    ]);
    deleted += pings.count + events.count;
  }
  return deleted;
}
